// "Path to the top": a growth plan built from the report. The AI finds real opportunities; the server checks the links,
// ranks the steps and adds up the budget, so numbers and links do not depend on the AI's arithmetic or memory.
import * as cheerio from 'cheerio';
import { safeFetchText } from './safe-fetch';

export interface Money { low: number; high: number; note?: string }

export interface PlanAnswers {
  goal: string; // what "the top" means to the person
  budgetCap: string; // e.g. "5000" or "none"
  hoursPerWeek: string;
  location: string;
  currency: string;
  focus: string[]; // awards, speaking, media, publications, funding, credentials, network
}

const OPP_TYPES = ['award', 'speaking', 'media', 'publication', 'grant', 'membership', 'training', 'partnership', 'other'] as const;
const FOCUS_LABEL: Record<string, string> = {
  awards: 'awards and recognition', speaking: 'speaking and conferences', media: 'media, podcasts and press', publications: 'publications and research',
  funding: 'grants and funding', credentials: 'credentials and training', network: 'partnerships, boards and network',
};

export function buildGrowthPrompt(subject: string, reportText: string, a: PlanAnswers): string {
  const focus = a.focus.length ? a.focus.map((f) => FOCUS_LABEL[f] || f).join(', ') : 'all areas';
  return `You are ExpertScan's career strategist. You have tools to search the web and open pages. Use them. The person below has a report about their public footprint. Build the clearest, most realistic plan to take them to the top of their field.

PERSON: ${subject}
THEIR GOAL IN THEIR OWN WORDS: ${a.goal || 'Not stated. Infer a realistic top goal from the report and say what you assumed.'}
BUDGET LIMIT: ${a.budgetCap || 'not stated'} ${a.currency}. TIME AVAILABLE: ${a.hoursPerWeek || 'not stated'} hours per week. LOCATION: ${a.location || 'not stated'}. FOCUS AREAS: ${focus}.

WRITING STYLE: plain, short sentences and everyday words so an ordinary reader understands. Be encouraging and honest. Never promise results.

RULES (most important):
1. Only recommend opportunities that REALLY EXIST. Search for them and OPEN the page. Every opportunity needs the real URL you opened, the next date or deadline (or "recurs every year, check the site"), the cost to apply or attend, who is eligible, and why this person fits, citing their own evidence from the report.
2. If you could not open a page, set "verified" to "snippet" (seen only in search results) or "not-checked". Never invent a name, URL, date, fee, journalist, award or event.
3. Define "the top" for THIS field by benchmarking against 3 to 5 real, well-known leaders in it. For each, list the milestones they reached (awards, keynotes, publications, appointments, media) with a source URL you opened. Compare honestly with the person: say where the gap is small, medium or large.
4. Find the EASIEST PATHWAY: order steps by impact for the effort, start with quick wins that unlock bigger ones (for example a credential or award that is required before a keynote or grant), and show what depends on what. Three phases: "Next 90 days", "3 to 12 months", "1 to 3 years". Respect the time and budget limits; if the goal cannot be reached inside them, say so and show what can.
5. Cover, as the focus areas ask: awards and recognition, speaking and conferences (with call-for-speaker deadlines), media and podcasts (real outlets and how to pitch them), journals and publications, grants and funding, memberships and boards, training and credentials, partnerships. Give at least 4 real opportunities per focus area where they exist.
6. BUDGET: list every cost needed (application and entry fees, travel, memberships, publishing fees, website and design, media or PR support, training, tools, legal and accounting, a contingency of about 10 percent). Give a low and a high estimate in ${a.currency} for each line, and state your assumption. Do NOT forecast income or revenue. Say plainly that costs are estimates.
7. List what else is needed: time per week, skills, tools and people (for example an editor, a PR advisor, a mentor).
8. Give measurable success markers with dates.
9. Reply with ONE JSON object and nothing else. No markdown. Escape double quotes inside text. Numbers must be plain numbers without symbols.

THE PERSON'S REPORT (their evidence):
${reportText}

JSON SHAPE:
{
  "field": "their field in a few words",
  "definitionOfTop": "what being at the top of this field looks like, in plain words",
  "currentStanding": "an honest 3 to 5 sentence summary of where the person stands now",
  "benchmarks": [{ "name": "", "whyBenchmark": "", "milestones": [""], "sourceUrl": "" }],
  "gaps": [{ "area": "awards | speaking | media | publications | credentials | network | online presence", "now": "", "topLevel": "", "gapSize": "small | medium | large" }],
  "opportunities": [{ "id": "O1", "type": "award | speaking | media | publication | grant | membership | training | partnership | other", "name": "", "organization": "", "url": "", "when": "", "cost": { "low": 0, "high": 0, "note": "" }, "eligibility": "", "whyFit": "", "howToApply": "", "effortHours": 0, "impact": 3, "verified": "opened | snippet | not-checked" }],
  "pathway": [{ "phase": "Next 90 days | 3 to 12 months | 1 to 3 years", "goal": "", "steps": [{ "action": "", "why": "", "opportunityIds": ["O1"], "dependsOn": ["O2"], "effortHours": 0, "cost": { "low": 0, "high": 0 } }] }],
  "budget": { "lineItems": [{ "item": "", "category": "", "low": 0, "high": 0, "when": "", "assumption": "" }], "notes": [""] },
  "resourcesNeeded": { "hoursPerWeek": "", "skills": [""], "tools": [""], "people": [""] },
  "successMarkers": [{ "milestone": "", "by": "", "howToMeasure": "" }],
  "assumptions": [""]
}`;
}

// ---------- Checking and calculating ----------

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const strings = (v: unknown, max = 8) => arr(v).map((x) => str(x, 300)).filter(Boolean).slice(0, max);
const money = (v: any): Money => { const low = num(v?.low); const high = Math.max(low, num(v?.high)); return { low, high, note: str(v?.note, 200) || undefined }; };

export type LinkState = 'opened-matches' | 'opened-no-match' | 'could-not-open' | 'no-link';

export interface Opportunity {
  id: string;
  type: string;
  name: string;
  organization: string;
  url: string;
  when: string;
  cost: Money;
  eligibility: string;
  whyFit: string;
  howToApply: string;
  effortHours: number;
  impact: number; // 1..5
  verified: string; // what the AI says
  linkState: LinkState; // what the server found
  score: number; // higher = easier path: impact for effort
}

export interface PlanStep { action: string; why: string; opportunityIds: string[]; dependsOn: string[]; effortHours: number; cost: Money }
export interface Phase { phase: string; goal: string; steps: PlanStep[]; totalCost: Money; totalHours: number }

export interface GrowthPlan {
  version: 1;
  subjectName: string;
  generatedAt: string;
  currency: string;
  answers: PlanAnswers;
  field: string;
  definitionOfTop: string;
  currentStanding: string;
  benchmarks: { name: string; whyBenchmark: string; milestones: string[]; sourceUrl: string; linkState: LinkState }[];
  gaps: { area: string; now: string; topLevel: string; gapSize: string }[];
  opportunities: Opportunity[];
  pathway: Phase[];
  budget: { lineItems: { item: string; category: string; low: number; high: number; when: string; assumption: string }[]; total: Money; pathwayTotal: Money; byCategory: Record<string, Money>; withinCap: boolean | null; notes: string[] };
  resourcesNeeded: { hoursPerWeek: string; skills: string[]; tools: string[]; people: string[] };
  successMarkers: { milestone: string; by: string; howToMeasure: string }[];
  assumptions: string[];
  checks: { opportunities: number; opened: number; matching: number; couldNotOpen: number; unverifiedDropped: number };
  disclaimer: string[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['the', 'of', 'and', 'for', 'annual', 'international', 'conference', 'awards', 'award', 'summit', 'in', 'at', 'a']);

async function checkLink(url: string, name: string, organization: string): Promise<LinkState> {
  if (!/^https?:\/\//i.test(url)) return 'no-link';
  const page = await safeFetchText(url, { timeoutMs: 9000, maxBytes: 700_000 });
  if (!page) return 'could-not-open';
  const hay = norm(cheerio.load(page.text).root().text() + ' ' + url);
  const words = [...new Set(norm(`${name} ${organization}`).split(' ').filter((w) => w.length > 3 && !STOP.has(w)))];
  const hits = words.filter((w) => hay.includes(w)).length;
  return words.length === 0 || hits >= Math.max(1, Math.ceil(words.length / 3)) ? 'opened-matches' : 'opened-no-match';
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]).catch(() => undefined as unknown as R); }
  }));
  return out;
}

const sum = (list: Money[]): Money => list.reduce((t, m) => ({ low: t.low + m.low, high: t.high + m.high }), { low: 0, high: 0 });

export async function buildGrowthPlan(raw: any, subject: string, answers: PlanAnswers): Promise<GrowthPlan> {
  // 1. Opportunities: real links only. Anything the server cannot open is kept but clearly marked.
  const oppsRaw = arr(raw?.opportunities).slice(0, 60);
  const states = await pool(oppsRaw, 6, (o) => checkLink(str(o?.url, 400), str(o?.name), str(o?.organization)));
  const ids = new Set<string>();
  const opportunities: Opportunity[] = oppsRaw.flatMap((o, i) => {
    const name = str(o?.name, 160);
    if (!name) return [];
    let id = str(o?.id, 12) || `O${i + 1}`;
    while (ids.has(id)) id += 'x';
    ids.add(id);
    const effort = Math.max(1, num(o?.effortHours) || 5);
    const impact = Math.min(5, Math.max(1, num(o?.impact) || 3));
    const cost = money(o?.cost);
    const linkState = states[i] || 'could-not-open';
    const score = Math.round((impact * 20 - Math.min(effort, 80) * 0.4 - Math.min(cost.high, 5000) / 250 + (linkState === 'opened-matches' ? 6 : 0)) * 10) / 10;
    return [{
      id, type: (OPP_TYPES as readonly string[]).includes(o?.type) ? o.type : 'other', name, organization: str(o?.organization, 160), url: str(o?.url, 400),
      when: str(o?.when, 200) || 'Check the website', cost, eligibility: str(o?.eligibility, 300), whyFit: str(o?.whyFit, 400), howToApply: str(o?.howToApply, 300),
      effortHours: effort, impact, verified: str(o?.verified, 20) || 'not-checked', linkState, score,
    }];
  }).sort((a, b) => b.score - a.score);
  const byId = new Map(opportunities.map((o) => [o.id, o]));

  // 2. Benchmarks: the leaders' sources must open
  const benchRaw = arr(raw?.benchmarks).slice(0, 6);
  const benchStates = await pool(benchRaw, 4, (b) => checkLink(str(b?.sourceUrl, 400), str(b?.name), ''));
  const benchmarks = benchRaw.flatMap((b, i) => {
    const name = str(b?.name, 120);
    return name ? [{ name, whyBenchmark: str(b?.whyBenchmark, 400), milestones: strings(b?.milestones, 8), sourceUrl: str(b?.sourceUrl, 400), linkState: (benchStates[i] || 'could-not-open') as LinkState }] : [];
  });

  // 3. Pathway: step costs and hours are added up here, never trusted from the AI's own totals
  const pathway: Phase[] = arr(raw?.pathway).slice(0, 4).map((p) => {
    const steps: PlanStep[] = arr(p?.steps).slice(0, 10).flatMap((s) => {
      const action = str(s?.action, 300);
      if (!action) return [];
      const oppIds = strings(s?.opportunityIds, 5).filter((id) => byId.has(id));
      const linked = oppIds.map((id) => byId.get(id)!);
      const given = money(s?.cost);
      // A step that points at real opportunities costs at least what those opportunities cost to enter
      const floor = sum(linked.map((o) => o.cost));
      const cost = { low: Math.max(given.low, floor.low), high: Math.max(given.high, floor.high, given.low, floor.low) };
      return [{ action, why: str(s?.why, 300), opportunityIds: oppIds, dependsOn: strings(s?.dependsOn, 4).filter((id) => byId.has(id)), effortHours: num(s?.effortHours), cost }];
    });
    return { phase: str(p?.phase, 40) || 'Phase', goal: str(p?.goal, 300), steps, totalCost: sum(steps.map((x) => x.cost)), totalHours: steps.reduce((t, x) => t + x.effortHours, 0) };
  }).filter((p) => p.steps.length);

  // 4. Budget: totals by category and overall
  const lineItems = arr(raw?.budget?.lineItems).slice(0, 40).flatMap((l) => {
    const item = str(l?.item, 160);
    if (!item) return [];
    const m = money(l);
    return [{ item, category: str(l?.category, 60) || 'Other', low: m.low, high: m.high, when: str(l?.when, 60), assumption: str(l?.assumption, 240) }];
  });
  const byCategory: Record<string, Money> = {};
  for (const l of lineItems) {
    const c = (byCategory[l.category] ||= { low: 0, high: 0 });
    c.low += l.low; c.high += l.high;
  }
  const total = sum(lineItems);
  const pathwayTotal = sum(pathway.map((p) => p.totalCost));
  const cap = num(answers.budgetCap);
  // The cautious figure is the larger of the two estimates, so a budget limit is never judged against the smaller one
  const cautiousHigh = Math.max(total.high, pathwayTotal.high);
  const withinCap = cap > 0 ? cautiousHigh <= cap : null;
  const budgetNotes = strings(raw?.budget?.notes, 6);
  if (pathwayTotal.high > total.high * 1.1) {
    budgetNotes.unshift(`The steps in the pathway add up to ${pathwayTotal.low} to ${pathwayTotal.high} ${answers.currency}, which is more than the budget table (${total.low} to ${total.high}). The two were estimated separately, so use the higher figure to stay safe, or choose fewer steps.`);
  }

  const checks = {
    opportunities: opportunities.length,
    opened: opportunities.filter((o) => o.linkState === 'opened-matches' || o.linkState === 'opened-no-match').length,
    matching: opportunities.filter((o) => o.linkState === 'opened-matches').length,
    couldNotOpen: opportunities.filter((o) => o.linkState === 'could-not-open' || o.linkState === 'no-link').length,
    unverifiedDropped: 0,
  };

  return {
    version: 1,
    subjectName: subject,
    generatedAt: new Date().toISOString(),
    currency: answers.currency,
    answers,
    field: str(raw?.field, 120),
    definitionOfTop: str(raw?.definitionOfTop, 700),
    currentStanding: str(raw?.currentStanding, 900),
    benchmarks,
    gaps: arr(raw?.gaps).slice(0, 8).map((g) => ({ area: str(g?.area, 40), now: str(g?.now, 300), topLevel: str(g?.topLevel, 300), gapSize: ['small', 'medium', 'large'].includes(g?.gapSize) ? g.gapSize : 'medium' })).filter((g) => g.area),
    opportunities,
    pathway,
    budget: { lineItems, total, pathwayTotal, byCategory, withinCap, notes: budgetNotes },
    resourcesNeeded: { hoursPerWeek: str(raw?.resourcesNeeded?.hoursPerWeek, 100), skills: strings(raw?.resourcesNeeded?.skills), tools: strings(raw?.resourcesNeeded?.tools), people: strings(raw?.resourcesNeeded?.people) },
    successMarkers: arr(raw?.successMarkers).slice(0, 10).map((m) => ({ milestone: str(m?.milestone, 200), by: str(m?.by, 60), howToMeasure: str(m?.howToMeasure, 200) })).filter((m) => m.milestone),
    assumptions: strings(raw?.assumptions, 10),
    checks,
    disclaimer: [
      'This plan is guidance, not a promise. Nobody can guarantee reaching the top of a field.',
      'Opportunities, dates and fees change. Open each link and confirm the details before you apply or pay.',
      'Costs are estimates with stated assumptions. The plan does not forecast income.',
      'Links marked "could not be opened" or "page does not match" need extra checking.',
    ],
  };
}
