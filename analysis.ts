// Builds the instructions for the AI and checks everything it sends back against the sources.
// Nothing reaches the report unless the server could confirm it exists in the research material.
import type {
  CommentAuthor, DimensionScore, EvidenceStatus, Finding, Gap, Indicator, IndicatorRating, Peer, PublicComment,
  RecognitionItem, RecognitionKind, Recommendation, ReportCoverage, ReportV2, SelfAssessmentAnswer, SourceRecord,
} from './report-types';

// ---------- Scoring: indicators and weights are fixed here, not chosen by the AI ----------

interface IndicatorDef { key: string; label: string; weight: number; hint: string }
interface DimensionDef { key: string; label: string; question: string; limitations: string; indicators: IndicatorDef[] }

export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'professional_credibility',
    label: 'Professional credibility',
    question: 'Does public evidence show real qualifications, experience and results?',
    limitations: 'Counts only what is public. A qualification that is real but not published online shows as "no public evidence".',
    indicators: [
      { key: 'qualifications', label: 'Qualifications and education', weight: 25, hint: 'degrees or certificates confirmed by a school, registry or reliable source' },
      { key: 'experience', label: 'Employment and experience', weight: 25, hint: 'roles and employers confirmed by more than the person\'s own page' },
      { key: 'demonstrated_work', label: 'Demonstrated work', weight: 20, hint: 'projects, products, cases or publications that can be opened and checked' },
      { key: 'outcomes', label: 'Results and outcomes', weight: 20, hint: 'measured results, case studies or independent reports of impact' },
      { key: 'registration', label: 'Professional registration', weight: 10, hint: 'licence, college or association membership that can be checked' },
    ],
  },
  {
    key: 'scientific_authority',
    label: 'Scientific authority',
    question: 'Do research records show real contributions that others use?',
    limitations: 'Based on open records (OpenAlex, ORCID, Crossref, Semantic Scholar). Google Scholar cannot be read automatically, and some work is not indexed.',
    indicators: [
      { key: 'publications', label: 'Publications', weight: 30, hint: 'papers or books found in a scholarly record' },
      { key: 'citations', label: 'Citations and author profile', weight: 25, hint: 'a research profile with citation counts' },
      { key: 'collaborators', label: 'Collaborations and co-authors', weight: 20, hint: 'named co-authors or institutions' },
      { key: 'conference_papers', label: 'Conference papers and academic talks', weight: 15, hint: 'proceedings or recorded academic presentations' },
      { key: 'grants', label: 'Research projects and grants', weight: 10, hint: 'funded or documented research projects' },
    ],
  },
  {
    key: 'public_visibility',
    label: 'Public visibility',
    question: 'How easy is it for an independent person to find this person and their work?',
    limitations: 'Visibility is not quality. It depends on what search engines show us, and some sites block automatic reading.',
    indicators: [
      { key: 'independent_pages', label: 'Pages by other people about them', weight: 30, hint: 'pages not written by the person or their organization' },
      { key: 'media', label: 'Media mentions', weight: 25, hint: 'news, interviews or articles by outlets' },
      { key: 'speaking', label: 'Speaking visibility', weight: 20, hint: 'talks, panels or podcasts that took place' },
      { key: 'reach', label: 'Audience reach', weight: 15, hint: 'followers, subscribers or views shown by a source' },
      { key: 'profiles', label: 'Active public profiles', weight: 10, hint: 'profiles on professional or social platforms' },
    ],
  },
  {
    key: 'reputation_trust',
    label: 'Reputation and trust',
    question: 'What do independent people say, and is it consistent with the person\'s claims?',
    limitations: 'Needs real comments, reviews or endorsements from other people. Few are public or readable, so this is often hard to judge.',
    indicators: [
      { key: 'third_party_feedback', label: 'Genuine third-party feedback', weight: 35, hint: 'real comments or reviews written by others' },
      { key: 'endorsements', label: 'Independent endorsements', weight: 30, hint: 'recommendations or awards given by others' },
      { key: 'criticism_checked', label: 'Documented criticism checked', weight: 15, hint: 'a search for complaints or controversy was possible and its result is clear' },
      { key: 'consistency', label: 'Consistency across sources', weight: 20, hint: 'titles, dates and claims match across different sources' },
    ],
  },
  {
    key: 'commercial_positioning',
    label: 'Commercial positioning',
    question: 'Is it clear what the person offers, to whom, and is there proof people buy it?',
    limitations: 'Based on public offers and proof. Private clients and sales are invisible to us.',
    indicators: [
      { key: 'clear_offer', label: 'Clear services or products', weight: 30, hint: 'a plain description of what is offered' },
      { key: 'proof', label: 'Proof of results', weight: 30, hint: 'case studies, client results or testimonials' },
      { key: 'client_fit', label: 'Relevance to target clients', weight: 20, hint: 'content aimed at a named kind of client' },
      { key: 'demand', label: 'Documented demand', weight: 20, hint: 'bookings, clients, partners or invitations shown by a source' },
    ],
  },
];

// ---------- Prompt ----------

export interface PromptInput {
  name: string;
  affiliation?: string;
  domain?: string;
  selfAssessment: SelfAssessmentAnswer[];
  selfSourceId?: string;
  excluded: { title: string; url: string }[];
  context: string;
}

const FINDING = `{ "text": "one plain sentence", "status": "verified|self-reported|observed|inference|hypothesis|unknown", "sources": ["S3"], "excerpt": "exact words copied from the source", "reasoning": "why, for inference and hypothesis" }`;

export function buildPrompt(i: PromptInput): string {
  const answers = i.selfAssessment.filter((a) => a.answer.trim());
  const indicatorList = DIMENSIONS.map((d) => `  "${d.key}": {\n${d.indicators.map((x) => `    "${x.key}": { "rating": "strong|partial|none_found|unknown", "sources": ["S1"], "note": "" }  // ${x.label}: ${x.hint}`).join('\n')}\n  }`).join(',\n');
  return `You are ExpertScan. You write an evidence-based report about the public footprint of one person, using ONLY the numbered sources below.

SUBJECT: "${i.name}"${i.affiliation ? `, linked to "${i.affiliation}"` : ''}${i.domain ? `, field "${i.domain}"` : ''}.
${i.excluded.length ? `\nPAGES THE USER SAYS BELONG TO SOMEONE ELSE (never use them):\n${i.excluded.map((e) => `- ${e.title} (${e.url})`).join('\n')}\n` : ''}
SELF-ASSESSMENT (the person's own answers, used only for "self-perception"):
${answers.length ? `These answers are source ${i.selfSourceId || 'the self-assessment'}. Cite it for self-perception and quote the person's own words.\n` + answers.map((a) => `- ${a.question}\n  Answer: ${a.answer}`).join('\n') : 'None given. Self-perception is therefore unknown: leave "selfPerception" empty.'}

WRITING STYLE: plain, short sentences and everyday words, so an ordinary reader understands. Explain any technical word. Be kind and honest. Write fewer items where evidence is weak and more only where sources support them. Never use filler.

EVIDENCE RULES (the most important part):
1. Cite sources only by their ids (like S3). Never invent a source, URL, quote, date, comment or person. If a fact is not in the sources, do not write it.
2. Give every finding a status:
   - verified: a reliable source that is NOT written by the subject confirms it. Needs "sources" and an exact "excerpt".
   - self-reported: the subject's own site or profile says it. Needs "sources" and an exact "excerpt".
   - observed: a real comment, review, testimonial or interaction found in a source. Needs "sources" and an exact "excerpt".
   - inference: your interpretation of identifiable evidence. Needs "sources" and "reasoning".
   - hypothesis: a possible explanation without enough evidence. Say what evidence would settle it.
   - unknown: the sources do not say.
3. Never claim to know what other people think unless a source shows it. Write like this instead: "Several professional identities appear on her public profiles. This may make her main offer unclear to enterprise clients. Direct evidence from prospective clients would be needed to know if this is true." (status hypothesis).
4. COMMENTS: copy only real comments, reviews or testimonials that appear word for word in a source. Never write a made-up or typical comment. If there are none, return an empty list. For each, say who wrote it: "third-party" (an independent person), "subject" (the person themself) or "organization" (the person's company or a promotional text).
5. Not finding something is NOT proof that it does not exist. Write "No public evidence found for ..." and never "does not have ...".
6. Do not treat allegations or rumours as facts. Report criticism only if a source documents it, and say how strong the source is.
7. Keep apart: what the subject says about themself (their own channels), and what independent sources show. Sources marked "Probably written by the person or their organization" are not independent.
8. Separate similar names. Use the field, employer and place to tell people apart. If unsure, say so in "duplicateIdentities".
9. Distinguish: invited to speak, delivered a talk, held an official appointment, contributed to research, or simply mentioned. Use the kinds: invited, delivered, appointed, contributed, mentioned.
10. PEERS: choose comparable experts only from the section "POSSIBLE PEERS" (never invent names). Explain why each is comparable and where they are stronger, and where they are more visible. Do not treat fame or followers as expertise. If that section is missing, return no peers and explain in "note".
11. RECOMMENDATIONS: prioritized, each tied to evidence, with importance, benefit, effort and a way to measure success. No revenue forecasts.
12. INDICATORS: for each indicator say strong, partial, none_found (searched but no public evidence) or unknown (could not be judged), and cite sources. Do not give numbers: the server calculates scores.

SOURCES AND RESEARCH MATERIAL:
${i.context}

OUTPUT: reply with ONE JSON object and nothing else (no markdown). Escape double quotes inside text. Use at most 6 items per list. Shape:
{
  "headline": "one plain sentence",
  "executive": { "findings": [FINDING], "confidence": "low|medium|high", "confidenceWhy": "", "limitations": [""] },
  "profile": { "education": [FINDING], "experience": [FINDING], "research": [FINDING], "business": [FINDING], "awards": [FINDING], "speakingMedia": [FINDING], "collaborations": [FINDING], "achievements": [FINDING], "notFound": ["No public evidence found for ..."] },
  "discoverability": { "findings": [FINDING] },
  "reputation": {
    "comments": [{ "text": "exact words", "sourceId": "S4", "platform": "", "date": "", "context": "", "author": "third-party|subject|organization", "tone": "positive|neutral|critical|mixed" }],
    "recognition": [{ "kind": "invited|delivered|appointed|contributed|mentioned", "text": "", "sources": ["S2"] }],
    "criticism": [FINDING]
  },
  "perception": {
    "selfPerception": [FINDING],
    "intendedIdentity": [FINDING],
    "observedExternal": [FINDING],
    "gaps": [{ "title": "", "intended": "what their own channels say", "observed": "what independent sources show", "status": "inference|hypothesis|verified|unknown", "confirmWith": "what evidence would settle it", "sources": [] }]
  },
  "competitive": { "field": "", "peers": [{ "name": "", "whyComparable": "", "strongerThanSubject": [""], "moreVisibleIn": [""], "sources": ["S9"] }], "gapsWorthAddressing": [FINDING], "note": "" },
  "risks": { "missingEvidence": [""], "inconsistencies": [FINDING], "outdated": [FINDING], "duplicateIdentities": [FINDING] },
  "recommendations": [{ "title": "", "why": "evidence in plain words", "importance": "high|medium|low", "benefit": "", "effort": "low|medium|high", "successMeasure": "a measurable result", "sources": [] }],
  "indicators": {
${indicatorList}
  }
}
FINDING means: ${FINDING}`;
}

// ---------- Checking the answer ----------

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// True when the excerpt really appears in the source text (a close match is accepted)
export function excerptSupported(excerpt: string, text: string): boolean {
  const e = norm(excerpt);
  const t = norm(text);
  if (e.length < 12) return false;
  if (t.includes(e)) return true;
  const words = e.split(' ');
  if (words.length < 6) return false;
  const shingles: string[] = [];
  for (let k = 0; k + 4 <= words.length; k++) shingles.push(words.slice(k, k + 4).join(' '));
  const found = shingles.filter((s) => t.includes(s)).length;
  return found / shingles.length >= 0.8;
}

const STATUSES: EvidenceStatus[] = ['verified', 'self-reported', 'observed', 'inference', 'hypothesis', 'unknown'];
const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export interface CheckContext {
  register: SourceRecord[];
  corpus: Record<string, string>;
  peerIds: Set<string>;
  subjectName: string;
}

export function checkFinding(raw: any, ctx: CheckContext): Finding | null {
  const text = str(raw?.text, 500);
  if (!text) return null;
  const byId = new Map(ctx.register.map((r) => [r.id, r]));
  const sources = arr(raw?.sources).map(String).filter((id) => byId.has(id));
  let status: EvidenceStatus = STATUSES.includes(raw?.status) ? raw.status : 'unknown';
  const reasoning = str(raw?.reasoning, 500) || undefined;
  const excerpt = str(raw?.excerpt, 400) || undefined;
  let excerptVerified: boolean | undefined;
  let note: string | undefined;

  const needsQuote = status === 'verified' || status === 'self-reported' || status === 'observed';
  if (needsQuote) {
    // The person's own answers are their own words: a self-reported finding that cites them needs no extra quote
    const fromOwnAnswers = status === 'self-reported' && sources.length > 0 && sources.every((id) => byId.get(id)!.kind === 'self-assessment');
    const supported = fromOwnAnswers || (!!excerpt && sources.some((id) => excerptSupported(excerpt, ctx.corpus[id] || '')));
    excerptVerified = supported;
    if (!sources.length || !supported) {
      status = 'unknown';
      note = 'The sources we read do not clearly support this, so it is shown as not proven.';
    } else if (status === 'verified' && sources.every((id) => byId.get(id)!.selfAuthored)) {
      status = 'self-reported';
      note = 'Only the person\'s own pages say this, so it is not independently verified.';
    }
  } else if (status === 'inference') {
    if (!sources.length) { status = 'hypothesis'; note = 'No source was given, so this is only a possible explanation.'; }
    else if (!reasoning) note = 'No reasoning was given for this interpretation.';
  }
  return { text, status, sources, reasoning, excerpt: needsQuote || excerpt ? excerpt : undefined, excerptVerified, note };
}

const findings = (v: unknown, ctx: CheckContext, max = 6): Finding[] =>
  arr(v).map((f) => checkFinding(f, ctx)).filter((f): f is Finding => !!f).slice(0, max);

const strings = (v: unknown, max = 8): string[] => arr(v).map((s) => str(s, 300)).filter(Boolean).slice(0, max);

const validIds = (v: unknown, ctx: CheckContext): string[] => {
  const ids = new Set(ctx.register.map((r) => r.id));
  return arr(v).map(String).filter((id) => ids.has(id));
};

function checkComments(v: unknown, ctx: CheckContext): { comments: PublicComment[]; dropped: number } {
  const byId = new Map(ctx.register.map((r) => [r.id, r]));
  const out: PublicComment[] = [];
  let dropped = 0;
  for (const c of arr(v)) {
    const text = str(c?.text, 500);
    const src = byId.get(String(c?.sourceId));
    if (!text || !src || !excerptSupported(text, ctx.corpus[src.id] || '')) { dropped++; continue; }
    let author: CommentAuthor = ['third-party', 'subject', 'organization'].includes(c?.author) ? c.author : 'organization';
    // A comment found on the person's own page cannot be counted as independent
    if (author === 'third-party' && src.selfAuthored && !/review|testimonial|comment/i.test(str(c?.context))) author = 'organization';
    out.push({
      text, sourceId: src.id, url: src.url, platform: str(c?.platform, 60) || src.kind, date: str(c?.date, 40) || undefined,
      context: str(c?.context, 200), author, tone: ['positive', 'neutral', 'critical', 'mixed'].includes(c?.tone) ? c.tone : 'neutral',
    });
  }
  return { comments: out.slice(0, 20), dropped };
}

function computeScores(raw: any, ctx: CheckContext): DimensionScore[] {
  return DIMENSIONS.map((d) => {
    const given = raw?.indicators?.[d.key] || {};
    const indicators: Indicator[] = d.indicators.map((def) => {
      const g = given[def.key] || {};
      const sources = validIds(g.sources, ctx);
      let rating: IndicatorRating = ['strong', 'partial', 'none_found', 'unknown'].includes(g.rating) ? g.rating : 'unknown';
      let note = str(g.note, 200) || undefined;
      // A positive rating needs at least one real source; without it we cannot judge
      if ((rating === 'strong' || rating === 'partial') && !sources.length) { rating = 'unknown'; note = 'No source was given for this.'; }
      return { key: def.key, label: def.label, weight: def.weight, rating, sources, note };
    });
    const total = indicators.reduce((s, x) => s + x.weight, 0);
    const known = indicators.filter((x) => x.rating !== 'unknown');
    const knownWeight = known.reduce((s, x) => s + x.weight, 0);
    const earned = known.reduce((s, x) => s + x.weight * (x.rating === 'strong' ? 1 : x.rating === 'partial' ? 0.5 : 0), 0);
    const coverage = total ? knownWeight / total : 0;
    // Scores are shown only when enough of the indicators could be judged
    const score = coverage >= 0.5 && knownWeight > 0 ? Math.round((earned / knownWeight) * 100) : null;
    return { key: d.key, label: d.label, question: d.question, score, coverage: Math.round(coverage * 100) / 100, indicators, limitations: d.limitations };
  });
}

export interface BuildInput {
  raw: any;
  ctx: CheckContext;
  coverage: ReportCoverage;
  selfAssessmentGiven: boolean;
  fallbackField: string;
}

export function buildReport(b: BuildInput): ReportV2 {
  const { raw, ctx, coverage } = b;
  const independent = ctx.register.filter((r) => !r.selfAuthored && !['peer research'].includes(r.kind)).length;
  const reasons: string[] = [];
  if (coverage.sourcesUsed < 10) reasons.push('Fewer than 10 sources were found.');
  if (independent < 4) reasons.push('Fewer than 4 sources were written by other people.');
  if (coverage.pagesRead < 3) reasons.push('Fewer than 3 pages could be read in full.');
  if (coverage.searchLimited) reasons.push('Web searches were partly blocked, so results are thinner than usual.');
  const provisional = reasons.length > 0;

  const modelConf = ['low', 'medium', 'high'].includes(raw?.executive?.confidence) ? raw.executive.confidence : 'low';
  const cap = reasons.length >= 2 ? 'low' : provisional ? 'medium' : 'high';
  const order = ['low', 'medium', 'high'];
  const confidence = order[Math.min(order.indexOf(modelConf), order.indexOf(cap))] as 'low' | 'medium' | 'high';

  const { comments, dropped } = checkComments(raw?.reputation?.comments, ctx);
  const third = comments.filter((c) => c.author === 'third-party');
  const counts: Record<string, number> = { positive: 0, neutral: 0, critical: 0, mixed: 0 };
  third.forEach((c) => counts[c.tone]++);
  const sentiment: ReportV2['reputation']['sentiment'] = third.length >= 10
    ? { status: 'scored', counts, total: third.length, note: `${third.length} genuine comments from other people were evaluated. They show what these commenters said, not necessarily what everyone thinks.` }
    : {
        status: 'insufficient', total: third.length,
        note: third.length === 0
          ? 'No genuine comments from other people could be collected, so we cannot say how the public feels.'
          : `Only ${third.length} genuine comment${third.length === 1 ? ' was' : 's were'} found. That is too few to say how the public feels overall.`,
      };

  const recognition: RecognitionItem[] = arr(raw?.reputation?.recognition).flatMap((r) => {
    const sources = validIds(r?.sources, ctx);
    const kind: RecognitionKind = ['invited', 'delivered', 'appointed', 'contributed', 'mentioned'].includes(r?.kind) ? r.kind : 'mentioned';
    const text = str(r?.text, 300);
    return text && sources.length ? [{ kind, text, sources }] : [];
  }).slice(0, 10);

  const gaps: Gap[] = arr(raw?.perception?.gaps).flatMap((g) => {
    const title = str(g?.title, 160);
    if (!title) return [];
    const sources = validIds(g?.sources, ctx);
    let status: EvidenceStatus = STATUSES.includes(g?.status) ? g.status : 'hypothesis';
    // A gap about outside opinion needs sources, otherwise it is only a hypothesis
    if (!sources.length && status !== 'unknown') status = 'hypothesis';
    return [{ title, intended: str(g?.intended, 400), observed: str(g?.observed, 400), status, confirmWith: str(g?.confirmWith, 300) || 'Direct evidence from the people concerned.', sources }];
  }).slice(0, 6);

  const peers: Peer[] = arr(raw?.competitive?.peers).flatMap((p) => {
    const name = str(p?.name, 100);
    const sources = validIds(p?.sources, ctx).filter((id) => ctx.peerIds.has(id));
    const tokens = norm(name).split(' ').filter((t) => t.length > 1);
    const mentioned = sources.some((id) => tokens.length > 0 && tokens.every((t) => norm(ctx.corpus[id] || '').includes(t)));
    if (!name || !mentioned) return [];
    return [{ name, whyComparable: str(p?.whyComparable, 300), strongerThanSubject: strings(p?.strongerThanSubject, 4), moreVisibleIn: strings(p?.moreVisibleIn, 4), sources }];
  }).slice(0, 6);

  const recommendations: Recommendation[] = arr(raw?.recommendations).flatMap((r) => {
    const title = str(r?.title, 160);
    const why = str(r?.why, 400);
    const successMeasure = str(r?.successMeasure, 300);
    if (!title || !why || !successMeasure) return [];
    return [{
      title, why, successMeasure,
      importance: ['high', 'medium', 'low'].includes(r?.importance) ? r.importance : 'medium',
      effort: ['low', 'medium', 'high'].includes(r?.effort) ? r.effort : 'medium',
      benefit: str(r?.benefit, 300), sources: validIds(r?.sources, ctx),
    }];
  }).slice(0, 6);
  const rank = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, c) => rank[a.importance] - rank[c.importance]);

  const field = str(raw?.competitive?.field, 120) || b.fallbackField;
  const competitiveNote = str(raw?.competitive?.note, 400)
    || (peers.length ? 'Peers come from public search results. Fame or follower counts are not treated as expertise.' : 'Not enough evidence to name comparable experts reliably.');

  return {
    version: 2,
    subjectName: ctx.subjectName,
    generatedAt: new Date().toISOString(),
    provisional,
    provisionalReasons: reasons,
    coverage,
    executive: {
      headline: str(raw?.headline, 240) || `Public footprint of ${ctx.subjectName}`,
      findings: findings(raw?.executive?.findings, ctx),
      confidence,
      confidenceWhy: str(raw?.executive?.confidenceWhy, 400) || (provisional ? 'The research was limited, so conclusions are provisional.' : 'Several independent sources were available.'),
      limitations: strings(raw?.executive?.limitations, 6),
    },
    profile: {
      education: findings(raw?.profile?.education, ctx),
      experience: findings(raw?.profile?.experience, ctx),
      research: findings(raw?.profile?.research, ctx),
      business: findings(raw?.profile?.business, ctx),
      awards: findings(raw?.profile?.awards, ctx),
      speakingMedia: findings(raw?.profile?.speakingMedia, ctx),
      collaborations: findings(raw?.profile?.collaborations, ctx),
      achievements: findings(raw?.profile?.achievements, ctx),
      notFound: strings(raw?.profile?.notFound, 10),
    },
    discoverability: { findings: findings(raw?.discoverability?.findings, ctx) },
    reputation: { comments, droppedComments: dropped, sentiment, recognition, criticism: findings(raw?.reputation?.criticism, ctx) },
    perception: {
      // Without the person's own answers, self-perception is unknown and nothing is guessed
      selfPerception: b.selfAssessmentGiven ? findings(raw?.perception?.selfPerception, ctx) : [],
      selfAssessmentGiven: b.selfAssessmentGiven,
      intendedIdentity: findings(raw?.perception?.intendedIdentity, ctx),
      observedExternal: findings(raw?.perception?.observedExternal, ctx),
      gaps,
    },
    competitive: { field, peers, gapsWorthAddressing: findings(raw?.competitive?.gapsWorthAddressing, ctx, 4), note: competitiveNote },
    risks: {
      missingEvidence: strings(raw?.risks?.missingEvidence, 10),
      inconsistencies: findings(raw?.risks?.inconsistencies, ctx, 5),
      outdated: findings(raw?.risks?.outdated, ctx, 5),
      duplicateIdentities: findings(raw?.risks?.duplicateIdentities, ctx, 4),
    },
    recommendations,
    scores: computeScores(raw, ctx),
    sources: ctx.register,
    methodology: [
      'We search several web search engines, news, encyclopedia and research records, and read the pages we can open.',
      'Every source gets a number. The AI may only use numbered sources, and the server removes quotes and comments that it cannot find in them.',
      'Each finding has a status: verified, self-reported, observed, inference, hypothesis or unknown. Click a finding to see its evidence.',
      'Scores come from fixed checklists with fixed weights. A score is shown only when at least half of its checklist could be judged.',
      'No public evidence does not mean something does not exist. It means we could not find it.',
      'Sites such as LinkedIn, Facebook, Instagram, TikTok and Discord block automatic reading, so their content is mostly missing.',
    ],
  };
}
