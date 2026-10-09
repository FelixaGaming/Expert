// Keyless deep research: several search engines, site-specific searches (LinkedIn, YouTube, Scholar...),
// news, academic and encyclopedia APIs, name-based domain discovery and full-page reading.
// Everything is gathered on the server and handed to the model as text.
import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import { safeFetchText } from './safe-fetch';


const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SourceRecord {
  id: string;
  url: string;
  title: string;
  kind: string;
  selfAuthored: boolean;
  accessedAt: string;
  published?: string;
  excerpt: string;
  flags: string[];
}

export interface SeedPage {
  url: string;
  title?: string;
  platform?: string;
  scraped?: string; // text the page-check window already read
}

export interface ResearchInput {
  name: string;
  affiliation?: string;
  domain?: string;
  seeds?: SeedPage[]; // pages the user confirmed: read first
  excludeUrls?: string[]; // pages the user said belong to someone else
  field?: string; // area of expertise, used to look for peers
  // 'profiles' skips reading full pages so the profile list comes back faster
  depth?: 'profiles' | 'deep';
}

export interface SocialLink {
  platform: string;
  url: string;
  evidence: string;
}

export interface ResearchCoverage {
  sourcesUsed: number;
  pagesRead: number;
  platformsFound: string[];
  platformsNotFound: string[];
  searchLimited: boolean;
}

export interface ResearchPack {
  register: SourceRecord[];
  corpus: Record<string, string>; // source id -> full text used for checking quotes
  coverage: ResearchCoverage;
  context: string;
  sources: { title: string; url: string }[];
  socials: SocialLink[];
  stats: Record<string, number>;
}

interface Hit {
  title: string;
  url: string;
  snippet: string;
  engines: Set<string>;
}

type RawHit = { title: string; url: string; snippet: string };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

async function getText(url: string, headers: Record<string, string> = {}, timeoutMs = 15_000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function getJson(url: string, timeoutMs = 15_000): Promise<any | null> {
  const t = await getText(url, { accept: 'application/json' }, timeoutMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

// ---------- Search engines ----------

async function bing(query: string): Promise<RawHit[]> {
  const html = await getText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`);
  if (!html) return [];
  const $ = cheerio.load(html);
  const out: RawHit[] = [];
  $('li.b_algo').each((_, el) => {
    const a = $(el).find('h2 a').first();
    let href = a.attr('href') || '';
    const m = href.match(/[?&]u=a1([^&]+)/);
    if (m) {
      try { href = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { return; }
    }
    if (/^https?:\/\//i.test(href)) out.push({ title: clean(a.text()), url: href, snippet: clean($(el).find('p').first().text()) });
  });
  return out;
}

async function braveGuarded(query: string): Promise<RawHit[]> {
  try {
    const res = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`, {
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) { markBlocked('brave'); return []; }
    if (!res.ok) return [];
    return parseBrave(await res.text());
  } catch {
    return [];
  }
}

function parseBrave(html: string): RawHit[] {
  const $ = cheerio.load(html);
  const out: RawHit[] = [];
  $('div.snippet[data-type="web"]').each((_, el) => {
    const href = $(el).find('a').first().attr('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    const title = clean($(el).find('.title').first().text()) || clean($(el).find('a').first().text());
    const snippet = clean($(el).find('.snippet-description, .content').first().text());
    out.push({ title, url: href, snippet });
  });
  return out;
}

async function duck(query: string): Promise<RawHit[]> {
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: new URLSearchParams({ q: query }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());
    const out: RawHit[] = [];
    $('.result').each((_, el) => {
      const a = $(el).find('a.result__a').first();
      let href = a.attr('href') || '';
      const m = href.match(/[?&]uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
      if (/^https?:\/\//i.test(href)) out.push({ title: clean(a.text()), url: href, snippet: clean($(el).find('.result__snippet').text()) });
    });
    return out;
  } catch {
    return [];
  }
}

// Engines block bursts, so each one is paced, cached for 30 minutes, and rested for 10 minutes after it throttles us.
const engineState: Record<string, { nextAt: number; blockedUntil: number }> = {};
const queryCache = new Map<string, { at: number; hits: RawHit[] }>();

function paced(name: string, gapMs: number, run: (q: string) => Promise<RawHit[]>) {
  return async (query: string): Promise<RawHit[]> => {
    const key = `${name}|${query}`;
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.at < 30 * 60_000) return cached.hits;
    const st = (engineState[name] ||= { nextAt: 0, blockedUntil: 0 });
    if (Date.now() < st.blockedUntil) return [];
    const wait = Math.max(0, st.nextAt - Date.now());
    st.nextAt = Date.now() + wait + gapMs;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const hits = await run(query);
    if (hits.length) queryCache.set(key, { at: Date.now(), hits });
    return hits;
  };
}

const markBlocked = (name: string) => {
  (engineState[name] ||= { nextAt: 0, blockedUntil: 0 }).blockedUntil = Date.now() + 3 * 60_000;
};

const ENGINES: { name: string; run: (q: string) => Promise<RawHit[]> }[] = [
  { name: 'bing', run: paced('bing', 900, bing) },
  { name: 'brave', run: paced('brave', 1600, braveGuarded) },
];

// Runs async jobs with a concurrency limit
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try { results[i] = await fn(items[i]); } catch { results[i] = undefined as unknown as R; }
      }
    }),
  );
  return results;
}

// ---------- Structured sources ----------

async function wikipedia(name: string): Promise<string[]> {
  const s = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=3`);
  const title = s?.query?.search?.[0]?.title as string | undefined;
  if (!title || !sameName(title, name)) return [];
  const ex = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json`);
  const page: any = Object.values(ex?.query?.pages || {})[0];
  const text = clean(page?.extract || '').slice(0, 1800);
  return text ? [`Wikipedia: ${title} (https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))})\n${text}`] : [];
}

async function openAlex(name: string, affiliation?: string): Promise<string[]> {
  const j = await getJson(`https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per-page=4`);
  const out: string[] = [];
  for (const a of j?.results || []) {
    if (!sameName(a.display_name || '', name)) continue;
    const inst = (a.last_known_institutions || []).map((i: any) => i.display_name).filter(Boolean).join('; ');
    const topics = (a.topics || []).slice(0, 5).map((t: any) => t.display_name).join(', ');
    let line = `OpenAlex author: ${a.display_name} | works: ${a.works_count} | citations: ${a.cited_by_count}${inst ? ` | institution: ${inst}` : ''}${topics ? ` | topics: ${topics}` : ''} | ${a.id}`;
    if (affiliation && inst && !inst.toLowerCase().includes(affiliation.toLowerCase().split(' ')[0])) line += ' (affiliation differs: possible namesake)';
    const works = await getJson(`https://api.openalex.org/works?filter=author.id:${encodeURIComponent(a.id)}&sort=cited_by_count:desc&per-page=5`);
    const titles = (works?.results || []).map((w: any) => `  - ${w.display_name} (${w.publication_year}, cited ${w.cited_by_count})${w.doi ? ` ${w.doi}` : ''}`);
    out.push([line, ...titles].join('\n'));
    if (out.length >= 2) break;
  }
  return out;
}

async function orcid(name: string): Promise<string[]> {
  const j = await getJson(`https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(name)}&rows=5`);
  return (j?.['expanded-result'] || [])
    .filter((r: any) => sameName(`${r['given-names'] || ''} ${r['family-names'] || ''}`, name))
    .slice(0, 3)
    .map((r: any) => `ORCID: ${r['given-names']} ${r['family-names']} https://orcid.org/${r['orcid-id']}${r['institution-name']?.length ? ` | ${r['institution-name'].join('; ')}` : ''}`);
}

async function semanticScholar(name: string): Promise<string[]> {
  const j = await getJson(`https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(name)}&limit=3&fields=name,affiliations,paperCount,citationCount,homepage,url`);
  return (j?.data || [])
    .filter((a: any) => sameName(a.name || '', name))
    .map((a: any) => `Semantic Scholar: ${a.name} | papers: ${a.paperCount} | citations: ${a.citationCount}${a.affiliations?.length ? ` | ${a.affiliations.join('; ')}` : ''} | ${a.url}`);
}

async function crossref(name: string): Promise<string[]> {
  const j = await getJson(`https://api.crossref.org/works?query.author=${encodeURIComponent(name)}&rows=5&select=title,author,issued,DOI,container-title`);
  return (j?.message?.items || [])
    .filter((w: any) => (w.author || []).some((a: any) => sameName(`${a.given || ''} ${a.family || ''}`, name)))
    .slice(0, 4)
    .map((w: any) => `Crossref: ${(w.title || [])[0] || 'untitled'} (${w.issued?.['date-parts']?.[0]?.[0] || 'n.d.'}${w['container-title']?.[0] ? `, ${w['container-title'][0]}` : ''}) https://doi.org/${w.DOI}`);
}

async function github(name: string): Promise<string[]> {
  const j = await getJson(`https://api.github.com/search/users?q=${encodeURIComponent(name)}+in:fullname&per_page=3`);
  return (j?.items || []).slice(0, 3).map((u: any) => `GitHub user: ${u.login} ${u.html_url}`);
}

async function googleNews(name: string): Promise<{ lines: string[]; sources: { title: string; url: string }[] }> {
  const xml = await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${name}"`)}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml) return { lines: [], sources: [] };
  const $ = cheerio.load(xml, { xmlMode: true });
  const lines: string[] = [];
  const sources: { title: string; url: string }[] = [];
  $('item').slice(0, 12).each((_, el) => {
    const title = clean($(el).find('title').first().text());
    const link = clean($(el).find('link').first().text());
    const src = clean($(el).find('source').first().text());
    const date = clean($(el).find('pubDate').first().text()).slice(0, 16);
    if (!title || !link) return;
    lines.push(`${title} | ${src} | ${date} | ${link}`);
    sources.push({ title: `${title} (${src})`, url: link });
  });
  return { lines, sources };
}

async function youtubeInfo(urls: string[]): Promise<string[]> {
  const videos = urls.filter((u) => /youtube\.com\/watch|youtu\.be\//i.test(u)).slice(0, 8);
  const rows = await pool(videos, 4, async (u) => {
    const j = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`, 8000);
    return j?.title ? `YouTube video: "${j.title}" by ${j.author_name} ${u}` : '';
  });
  return rows.filter(Boolean);
}

// ---------- Social profile discovery (keyless) ----------

const SOCIAL_HOSTS: { platform: string; host: RegExp }[] = [
  { platform: 'LinkedIn', host: /(^|\.)linkedin\.com$/ },
  { platform: 'Facebook', host: /(^|\.)facebook\.com$|^fb\.com$/ },
  { platform: 'Instagram', host: /(^|\.)instagram\.com$/ },
  { platform: 'TikTok', host: /(^|\.)tiktok\.com$/ },
  { platform: 'X / Twitter', host: /(^|\.)(x|twitter)\.com$/ },
  { platform: 'YouTube', host: /(^|\.)youtube\.com$|^youtu\.be$/ },
  { platform: 'Discord', host: /(^|\.)discord\.(com|gg)$/ },
  { platform: 'Reddit', host: /(^|\.)reddit\.com$/ },
  { platform: 'Bluesky', host: /(^|\.)bsky\.app$/ },
  { platform: 'Threads', host: /(^|\.)threads\.(net|com)$/ },
  { platform: 'Mastodon', host: /(^|\.)mastodon\.[a-z]+$/ },
  { platform: 'GitHub', host: /(^|\.)github\.com$/ },
  { platform: 'Medium', host: /(^|\.)medium\.com$/ },
  { platform: 'Substack', host: /(^|\.)substack\.com$/ },
  { platform: 'Pinterest', host: /(^|\.)pinterest\.[a-z.]+$/ },
  { platform: 'Google Scholar', host: /^scholar\.google\.[a-z.]+$/ },
  { platform: 'ResearchGate', host: /(^|\.)researchgate\.net$/ },
  { platform: 'ORCID', host: /(^|\.)orcid\.org$/ },
];

// Share buttons, trackers and site-wide links are not a person's profile
const NOT_A_PROFILE = /\/(sharer|share|intent|tr|plugins|dialog|login|signup|policies|help|hashtag|explore|search|watch|feed|embed|oauth)(\/|\?|$)|shareArticle|\/company\/|\/school\/|\/pages\/|\/groups\/|\/events\//i;

export function classifySocial(raw: string): { platform: string; url: string } | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const hit = SOCIAL_HOSTS.find((h) => h.host.test(host));
  if (!hit) return null;
  const path = u.pathname.replace(/\/+$/, '');
  if (path.length < 2 || NOT_A_PROFILE.test(u.pathname + u.search)) return null;
  return { platform: hit.platform, url: `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, '') + (/profile\.php/.test(u.pathname) ? u.search : '') };
}

const WIKIDATA_PROPS: [string, (v: string) => string][] = [
  ['P2002', (v) => `https://x.com/${v}`],
  ['P2003', (v) => `https://www.instagram.com/${v}`],
  ['P2013', (v) => `https://www.facebook.com/${v}`],
  ['P6634', (v) => `https://www.linkedin.com/in/${v}`],
  ['P7085', (v) => `https://www.tiktok.com/@${v}`],
  ['P2397', (v) => `https://www.youtube.com/channel/${v}`],
  ['P2037', (v) => `https://github.com/${v}`],
  ['P3836', (v) => `https://www.pinterest.com/${v}`],
  ['P4264', (v) => `https://www.linkedin.com/company/${v}`],
  ['P496', (v) => `https://orcid.org/${v}`],
  ['P1960', (v) => `https://scholar.google.com/citations?user=${v}`],
  ['P2038', (v) => `https://www.researchgate.net/profile/${v}`],
  ['P8904', (v) => `https://www.threads.net/@${v}`],
  ['P11892', (v) => `https://bsky.app/profile/${v}`],
];

// Wikidata lists the official accounts of notable people. Returns also the person's Wikipedia title when there is one.
async function wikidataSocials(name: string): Promise<{ socials: SocialLink[]; wikipediaTitle?: string }> {
  const search = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json`);
  const candidates = (search?.search || []).filter((e: any) => (e.label || '').toLowerCase() === name.toLowerCase().trim());
  const socials: SocialLink[] = [];
  let wikipediaTitle: string | undefined;
  for (const cand of candidates.slice(0, 2)) {
    const ent = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${cand.id}&props=claims|sitelinks&format=json`);
    const e = ent?.entities?.[cand.id];
    const claims = e?.claims || {};
    const isHuman = (claims.P31 || []).some((c: any) => c.mainsnak?.datavalue?.value?.id === 'Q5');
    if (!isHuman) continue;
    wikipediaTitle ||= e?.sitelinks?.enwiki?.title;
    for (const [prop, build] of WIKIDATA_PROPS) {
      for (const c of (claims[prop] || []).slice(0, 1)) {
        const v = c.mainsnak?.datavalue?.value;
        if (typeof v !== 'string' || !v) continue;
        const c2 = classifySocial(build(encodeURIComponent(v).replace(/%40/g, '@')));
        if (c2) socials.push({ ...c2, evidence: `Listed on Wikidata (${cand.id}${cand.description ? `, ${cand.description}` : ''})` });
      }
    }
    if (socials.length) break;
  }
  return { socials, wikipediaTitle };
}

async function wikipediaLinks(title: string): Promise<SocialLink[]> {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&titles=${encodeURIComponent(title)}&ellimit=500&format=json`);
  const page: any = Object.values(j?.query?.pages || {})[0];
  const out: SocialLink[] = [];
  for (const l of page?.extlinks || []) {
    const c = classifySocial(l['*'] || '');
    if (c) out.push({ ...c, evidence: `Linked from the Wikipedia article "${title}"` });
  }
  return out;
}

async function youtubeChannels(name: string): Promise<SocialLink[]> {
  const html = await getText(`https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D`);
  if (!html) return [];
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  let data: any;
  try { data = JSON.parse(m[1]); } catch { return []; }
  const out: SocialLink[] = [];
  const walk = (o: any) => {
    if (!o || typeof o !== 'object' || out.length >= 3) return;
    const ch = o.channelRenderer;
    if (ch) {
      const title = ch.title?.simpleText || '';
      const path = ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
      const subs = ch.videoCountText?.simpleText || ch.subscriberCountText?.simpleText || '';
      if (path && sameName(title, name)) out.push({ platform: 'YouTube', url: `https://www.youtube.com${path}`, evidence: `YouTube channel search: "${title}"${subs ? ` (${subs})` : ''}` });
    }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
  };
  walk(data);
  return out;
}

async function blueskyProfiles(name: string): Promise<SocialLink[]> {
  const j = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(name)}&limit=5`);
  return (j?.actors || [])
    .filter((a: any) => sameName(`${a.displayName || ''} ${a.handle || ''}`.replace(/[._-]/g, ' '), name) || sameName((a.handle || '').split('.')[0], nameTokens(name).join('')))
    .slice(0, 2)
    .map((a: any) => ({ platform: 'Bluesky', url: `https://bsky.app/profile/${a.handle}`, evidence: `Bluesky search: ${a.displayName || a.handle}` }));
}

// ---------- Name helpers ----------

function nameTokens(name: string): string[] {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !['dr', 'prof', 'mr', 'mrs', 'ms', 'phd'].includes(t));
}

function sameName(candidate: string, name: string): boolean {
  const c = candidate.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const t = nameTokens(name);
  return t.length > 0 && t.every((x) => c.includes(x));
}

// ---------- Name-based domain discovery ----------

async function candidateDomains(name: string): Promise<{ lines: string[]; sources: { title: string; url: string }[] }> {
  const t = nameTokens(name);
  if (t.length < 2) return { lines: [], sources: [] };
  const first = t[0];
  const last = t[t.length - 1];
  const slugs = [...new Set([`${first}${last}`, `${first}-${last}`, `dr${first}${last}`, `dr${last}`, `${last}${first}`, `${first[0]}${last}`])];
  const tlds = ['com', 'ca', 'org', 'net', 'io', 'co'];
  const hosts = slugs.flatMap((s) => tlds.map((tld) => `${s}.${tld}`));
  const live = (await pool(hosts, 10, async (h) => {
    try { await dns.lookup(h); return h; } catch { return ''; }
  })).filter(Boolean);
  const lines: string[] = [];
  const sources: { title: string; url: string }[] = [];
  await pool(live, 4, async (h) => {
    const page = await safeFetchText(`https://${h}`, { timeoutMs: 7000, maxBytes: 200_000 });
    if (!page) return;
    const $ = cheerio.load(page.text);
    const title = clean($('title').first().text());
    const desc = clean($('meta[name="description"]').attr('content') || '');
    const body = clean($('body').text()).slice(0, 4000).toLowerCase();
    const mentions = t.every((x) => body.includes(x) || title.toLowerCase().includes(x));
    lines.push(`${mentions ? 'Domain that mentions the name' : 'Domain exists but does not mention the name (probably unrelated)'}: ${page.finalUrl} | ${title}${desc ? ` | ${desc.slice(0, 200)}` : ''}`);
    if (mentions) sources.push({ title: title || h, url: page.finalUrl });
  });
  return { lines, sources };
}

// ---------- Page reading ----------

const UNREADABLE = /(linkedin|facebook|instagram|x|twitter|youtube|youtu|tiktok|pinterest|google|bing)\.(com|be)$/i;

const SITE_PAGE_KEYWORDS = /award|recogni|speak|present|talk|keynote|media|press|publication|research|about|cv|bio|experience|portfolio|news|event|testimon|workshop|consult|service|advis|board|honou?r|interview|podcast|webinar|article|book/i;
const SKIP_EXT = /\.(jpg|jpeg|png|gif|svg|webp|css|js|zip|mp4|mp3|ico|woff2?)(\?|$)/i;

// Full text of a page in reading order, keeping lists and cards (awards, talks, roles live there)
function fullPageText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, svg, form, iframe').remove();
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, br, section, article, blockquote').each((_, el) => { $(el).append('\n'); });
  return $('body').text().replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

// `fullSet` holds normalized URLs to read in full (the user's confirmed pages and own sites); others get a short excerpt.
async function readPages(urls: string[], name: string, fullSet: Set<string> = new Set()): Promise<{ texts: string[]; socials: SocialLink[]; internal: string[] }> {
  const tokens = nameTokens(name);
  const socials: SocialLink[] = [];
  const internal: string[] = [];
  const rows = await pool(urls, 5, async (u) => {
    const page = await safeFetchText(u, { timeoutMs: 12000, maxBytes: fullSet.has(normUrl(u)) ? 1_500_000 : 400_000 });
    if (!page || !/html/i.test(page.contentType)) return '';
    const $ = cheerio.load(page.text);
    const isFull = fullSet.has(normUrl(u));
    // Links to social profiles on pages that are about this person (their own sites, bios, directories)
    const aboutThem = tokens.every((t) => page.text.toLowerCase().includes(t));
    const host = new URL(page.finalUrl).hostname.replace(/^www\./, '');
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      let abs = '';
      try { abs = new URL(href, page.finalUrl).toString(); } catch { return; }
      if (aboutThem) {
        const c = classifySocial(abs);
        if (c) socials.push({ ...c, evidence: `Linked from ${page.finalUrl}` });
      }
      // Other pages of the same site, so the whole site can be read (awards, talks and so on are often on their own pages)
      if (isFull) {
        try {
          const l = new URL(abs);
          if (l.hostname.replace(/^www\./, '') === host && /^https?:$/.test(l.protocol) && l.pathname.length > 1 && !SKIP_EXT.test(l.pathname)) {
            l.hash = '';
            internal.push(l.toString());
          }
        } catch { /* ignore bad links */ }
      }
    });
    const title = clean($('title').first().text());
    const desc = clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '');
    if (isFull) {
      const text = fullPageText($).slice(0, 40_000);
      if (!title && !text) return '';
      return `PAGE ${page.finalUrl}\nTitle: ${title}${desc ? `\nDescription: ${desc.slice(0, 300)}` : ''}\nText:\n${text}`;
    }
    $('script, style, nav, footer, header, aside, form, noscript, svg').remove();
    const heads = $('h1, h2, h3').slice(0, 8).map((_, e) => clean($(e).text())).get().filter(Boolean).join(' / ');
    const paras = $('p, li').map((_, e) => clean($(e).text())).get().filter((p) => p.length > 40).join(' ').slice(0, 4000);
    if (!title && !paras) return '';
    return `PAGE ${page.finalUrl}\nTitle: ${title}${desc ? `\nDescription: ${desc.slice(0, 300)}` : ''}${heads ? `\nHeadings: ${heads.slice(0, 400)}` : ''}\nText: ${paras}`;
  });
  return { texts: rows.filter(Boolean), socials, internal };
}

// ---------- Peers (comparable experts) ----------

async function authorTopics(name: string): Promise<string[]> {
  const j = await getJson(`https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per-page=3`);
  const a = (j?.results || []).find((x: any) => sameName(x.display_name || '', name));
  return (a?.topics || []).slice(0, 3).map((t: any) => t.display_name as string).filter(Boolean);
}

// Top researchers in the same field, from the open OpenAlex index (reliable, no key).
// Search-engine results are not used for peers: when an engine is throttled they are unrelated pages.
async function peerHits(field: string, ownTopics: string[]): Promise<RawHit[]> {
  const words = field.split(/[,/;&]| and /i).map((x) => x.trim()).filter(Boolean);
  // The person's own research topics match best, so they go first
  const candidates = [...new Set([...ownTopics, field, ...words, ...field.split(/\s+/).filter((w) => w.length > 4)])].slice(0, 8);
  const seen = new Set<string>();
  const topics: { id: string; name: string }[] = [];
  for (const c of candidates) {
    if (topics.length >= 3) break;
    const j = await getJson(`https://api.openalex.org/topics?search=${encodeURIComponent(c)}&per-page=1`);
    const t = j?.results?.[0];
    if (t?.id && !seen.has(t.id)) { seen.add(t.id); topics.push({ id: t.id, name: t.display_name }); }
  }
  const out: RawHit[] = [];
  for (const t of topics) {
    const authors = await getJson(`https://api.openalex.org/authors?filter=topics.id:${encodeURIComponent(t.id.split('/').pop() || '')}&sort=cited_by_count:desc&per-page=6`);
    for (const a of authors?.results || []) {
      const inst = (a.last_known_institutions || []).map((i: any) => i.display_name).filter(Boolean).join('; ');
      out.push({
        title: `${a.display_name} (leading researcher in "${t.name}")`,
        url: a.id,
        snippet: `${a.display_name}: ${a.works_count} works, ${a.cited_by_count} citations${inst ? `, ${inst}` : ''}. Field: ${t.name}.`,
      });
    }
  }
  return out;
}

// ---------- Orchestration ----------

const normUrl = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^twitter\.com/, 'x.com');

export async function gatherResearch(input: ResearchInput, maxChars = 70_000): Promise<ResearchPack> {
  const { name, affiliation, domain } = input;
  const deep = input.depth !== 'profiles';
  const q = `"${name}"`;
  const extra = [affiliation, domain].filter(Boolean).join(' ');
  const excluded = new Set((input.excludeUrls || []).map(normUrl));
  const isExcluded = (u: string) => excluded.has(normUrl(u));

  // Search engines throttle bursts and, when they do, ignore topic words and return the same pages.
  // Queries scoped with site: stay reliable, so each topic is covered by a group of sites.
  const queries = [
    q,
    ...(extra ? [`${q} ${extra}`] : []),
    // Social platforms are always searched
    `${q} site:linkedin.com/in`,
    `${q} site:facebook.com`,
    `${q} site:instagram.com OR site:tiktok.com`,
    `${q} site:youtube.com OR site:vimeo.com OR site:spotify.com OR site:podcasts.apple.com`,
    `${q} site:x.com OR site:twitter.com OR site:threads.net`,
    `${q} site:discord.com OR site:discord.gg`,
    `${q} site:reddit.com OR site:quora.com`,
    // Research and education
    `${q} site:scholar.google.com OR site:researchgate.net OR site:academia.edu OR site:orcid.org OR site:semanticscholar.org OR site:pubmed.ncbi.nlm.nih.gov OR site:arxiv.org`,
    `${q} site:edu`,
    ...(deep
      ? [
          // Speaking, press, business, directories, reviews
          `${q} site:eventbrite.com OR site:meetup.com OR site:slideshare.net OR site:sessionize.com OR site:ted.com`,
          `${q} site:medium.com OR site:substack.com OR site:forbes.com OR site:businessinsider.com OR site:theguardian.com`,
          `${q} site:crunchbase.com OR site:bloomberg.com OR site:opencorporates.com OR site:patents.google.com`,
          `${q} site:psychologytoday.com OR site:healthgrades.com OR site:doximity.com OR site:avvo.com OR site:clutch.co`,
          `${q} site:trustpilot.com OR site:glassdoor.com OR site:yelp.com`,
          `${q} site:org OR site:gov`,
        ]
      : []),
  ];

  const plain = new Set<string>([q]);
  const jobs: { engine: (typeof ENGINES)[number]; query: string }[] = queries.flatMap((query) => ENGINES.map((engine) => ({ engine, query })));
  const hitMap = new Map<string, Hit>();
  let engineFailures = 0;
  const perEngine: Record<string, { ok: number; empty: number }> = {};
  const junk: Record<string, number> = {};

  // Keyless social discovery runs alongside the search engines
  const socialDiscovery = (async () => {
    const [wd, ytc, bsky] = await Promise.all([wikidataSocials(name), youtubeChannels(name), blueskyProfiles(name)]);
    const wp = wd.wikipediaTitle ? await wikipediaLinks(wd.wikipediaTitle) : [];
    return [...wd.socials, ...wp, ...ytc, ...bsky];
  })().catch(() => [] as SocialLink[]);

  const structured = Promise.all([
    wikipedia(name), openAlex(name, affiliation), orcid(name), semanticScholar(name), crossref(name), github(name), googleNews(name), candidateDomains(name),
  ]);

  const fieldPromise = (async () => {
    if (!deep) return '';
    if (input.field?.trim()) return input.field.trim();
    if (domain?.trim()) return domain.trim();
    return (await authorTopics(name)).join(' ');
  })().catch(() => '');
  const ownTopicsPromise = deep ? authorTopics(name).catch(() => [] as string[]) : Promise.resolve([] as string[]);

  await pool(jobs, 6, async ({ engine, query }) => {
    let results = await engine.run(query);
    const asked = engine.name;
    if (!results.length && engine.name === 'bing') {
      results = await duck(query);
      if (results.length) engine = { name: 'duckduckgo', run: duck };
    }
    const rec = (perEngine[asked] ||= { ok: 0, empty: 0 });
    // A throttled engine answers with unrelated pages: if nothing mentions the surname, count it as a failure
    const lastName = nameTokens(name).slice(-1)[0] || '';
    const relevant = results.some((r) => `${r.title} ${r.snippet} ${r.url}`.toLowerCase().includes(lastName));
    if (results.length && !relevant) {
      results = [];
      // Only a plain name search that returns nothing about the person signals throttling;
      // platform-specific queries legitimately come back empty when the person has no profile there.
      if (plain.has(query)) {
        junk[asked] = (junk[asked] || 0) + 1;
        if (junk[asked] >= 2) markBlocked(asked);
      }
    }
    if (results.length) rec.ok++; else rec.empty++;
    if (!results.length) engineFailures++;
    for (const r of results) {
      if (isExcluded(r.url)) continue;
      const key = normUrl(r.url);
      const existing = hitMap.get(key);
      if (existing) {
        existing.engines.add(engine.name);
        if (r.snippet.length > existing.snippet.length) existing.snippet = r.snippet;
      } else {
        hitMap.set(key, { ...r, engines: new Set([engine.name]) });
      }
    }
  });

  const tokens = nameTokens(name);
  const lastToken = tokens[tokens.length - 1] || '';
  const score = (h: Hit) => {
    const hay = `${h.title} ${h.snippet} ${h.url}`.toLowerCase();
    let sc = h.engines.size * 2;
    if (tokens.every((t) => hay.includes(t))) sc += 4;
    else if (lastToken && hay.includes(lastToken)) sc += 1;
    else sc -= 5;
    if (affiliation && hay.includes(affiliation.toLowerCase().split(' ')[0])) sc += 2;
    return sc;
  };
  const hits = [...hitMap.values()].filter((h) => score(h) > 0).sort((a, b) => score(b) - score(a)).slice(0, 60);

  const [wiki, oa, orc, ss, cr, gh, news, domains] = await structured;
  const yt = await youtubeInfo(hits.map((h) => h.url));
  const field = await fieldPromise;

  // Read the user's confirmed pages first, then the best other pages
  const seeds = (input.seeds || []).filter((s) => s.url && !isExcluded(s.url));
  const seedUrls = new Set(seeds.map((s) => normUrl(s.url)));
  const seenHosts = new Set<string>();
  const toRead = [
    ...seeds.filter((s) => !UNREADABLE.test(new URL(s.url).hostname.replace(/^www\./, ''))).map((s) => s.url),
    ...hits
      .filter((h) => {
        let host = '';
        try { host = new URL(h.url).hostname.replace(/^www\./, ''); } catch { return false; }
        if (UNREADABLE.test(host) || seenHosts.has(host) || seedUrls.has(normUrl(h.url))) return false;
        seenHosts.add(host);
        return true;
      })
      .slice(0, deep ? 14 : 6)
      .map((h) => h.url),
    ...domains.sources.map((d) => d.url),
  ];
  // Own sites (pages the user confirmed, and domains named after the person) are read in full, then their other pages too
  const fullSet = new Set<string>([
    ...seeds.map((sd) => normUrl(sd.url)),
    ...domains.sources.map((d) => normUrl(d.url)),
  ]);
  const read = await readPages([...new Set(toRead)], name, fullSet);
  const alreadyRead = new Set(toRead.map(normUrl));
  const ownPages = new Set<string>(fullSet);
  if (fullSet.size) {
    const rank = (u: string) => (SITE_PAGE_KEYWORDS.test(new URL(u).pathname) ? 1 : 0);
    const more = [...new Set(read.internal)]
      .filter((u) => !alreadyRead.has(normUrl(u)) && !isExcluded(u))
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, 16);
    if (more.length) {
      more.forEach((u) => { fullSet.add(normUrl(u)); ownPages.add(normUrl(u)); });
      const crawled = await readPages(more, name, fullSet);
      read.texts.push(...crawled.texts);
      read.socials.push(...crawled.socials);
    }
  }
  const pageSocials = read.socials;

  // Peers: who else works in this field (never the person themself)
  let peers: RawHit[] = [];
  if (deep && field) {
    peers = (await peerHits(field, await ownTopicsPromise)).filter((h) => !sameName(`${h.title} ${h.snippet}`, name)).slice(0, 14);
  }

  // Social profiles: strongest evidence first, no duplicates, at most 3 per platform
  const fromHits: SocialLink[] = hits.flatMap((h) => {
    const c = classifySocial(h.url);
    const hay = `${h.title} ${h.snippet} ${h.url}`.toLowerCase();
    return c && tokens.every((t) => hay.includes(t)) ? [{ ...c, evidence: `${h.title}${h.snippet ? `: ${h.snippet.slice(0, 220)}` : ''}` }] : [];
  });
  const first = tokens[0] || '';
  const resemblesPerson = (l: SocialLink) => {
    const handle = decodeURIComponent(l.url.replace(/^https?:\/\/[^/]+\//, '')).toLowerCase().replace(/[^a-z0-9]/g, '');
    return (lastToken.length >= 3 && handle.includes(lastToken)) || (first.length >= 4 && handle.includes(first));
  };
  const discovered = await socialDiscovery;
  const trusted = discovered.filter((l) => /^Listed on Wikidata|^YouTube channel search|^Bluesky search/.test(l.evidence));
  const loose = [...discovered.filter((l) => !trusted.includes(l)), ...pageSocials].filter(resemblesPerson);
  const seenSocial = new Set<string>();
  const perPlatform: Record<string, number> = {};
  const socials = [...trusted, ...fromHits, ...loose].filter((l) => {
    const key = normUrl(l.url);
    if (isExcluded(l.url) || seenSocial.has(key) || (perPlatform[l.platform] || 0) >= (l.platform === 'LinkedIn' || l.platform === 'Facebook' ? 8 : 3)) return false;
    seenSocial.add(key);
    perPlatform[l.platform] = (perPlatform[l.platform] || 0) + 1;
    return true;
  });

  // ---------- Source register: every fact the model may use gets a numbered source ----------
  const register: SourceRecord[] = [];
  const corpus: Record<string, string> = {};
  const idByUrl = new Map<string, string>();
  const accessedAt = new Date().toISOString().slice(0, 10);
  const ownHosts = new Set<string>();
  const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  const OWN_PLATFORM = /personal|corporate|practice|professional website|github pages|portfolio|own website|company website/i;
  for (const sd of seeds) if (OWN_PLATFORM.test(sd.platform || '')) ownHosts.add(hostOf(sd.url));
  for (const d of domains.sources) ownHosts.add(hostOf(d.url));
  const hostNamesPerson = (u: string) => { const h = hostOf(u).replace(/[^a-z]/g, ''); return !!lastToken && lastToken.length >= 4 && h.includes(lastToken); };
  const ownSocial = new Set(socials.filter(resemblesPerson).map((l) => normUrl(l.url)));

  const add = (kind: string, url: string, title: string, text: string, opts: { published?: string; flags?: string[]; selfAuthored?: boolean } = {}) => {
    if (!url || isExcluded(url)) return;
    const key = normUrl(url);
    const big = kind === 'your confirmed page' || kind === 'own site page';
    const clipped = text.slice(0, big ? 40_000 : kind === 'page' ? 4000 : 600);
    const existing = idByUrl.get(key);
    if (existing) {
      // The full page text goes first, ahead of any short summary that was already stored
      if (!corpus[existing].includes(clipped.slice(0, 80))) corpus[existing] = (big ? `${clipped}\n${corpus[existing]}` : `${corpus[existing]}\n${clipped}`).slice(0, big ? 40_000 : 4000);
      const rec = register.find((r) => r.id === existing)!;
      if ((kind === 'page' || big) && rec.kind === 'search result') {
        rec.kind = kind;
        rec.flags = rec.flags.filter((f) => f !== 'Only a search snippet: the page itself was not read');
      }
      rec.excerpt = corpus[existing].slice(0, 400);
      return;
    }
    const id = `S${register.length + 1}`;
    const self = opts.selfAuthored ?? (ownHosts.has(hostOf(url)) || hostNamesPerson(url) || ownSocial.has(key));
    const flags = [...(opts.flags || [])];
    if (self) flags.push('Probably written by the person or their organization');
    if (!opts.published) flags.push('Publication date unknown');
    if (kind === 'search result') flags.push('Only a search snippet: the page itself was not read');
    idByUrl.set(key, id);
    corpus[id] = clipped;
    register.push({ id, url, title: clean(title).slice(0, 160) || url, kind, selfAuthored: self, accessedAt, published: opts.published, excerpt: clipped.slice(0, 400), flags });
  };

  for (const sd of seeds) add('your confirmed page', sd.url, sd.title || sd.url, sd.scraped || sd.title || '', { selfAuthored: OWN_PLATFORM.test(sd.platform || '') || undefined });
  for (const w of wiki) { const u = w.match(/\((https?:\/\/[^)\s]+)\)/)?.[1]; if (u) add('encyclopedia', u, w.split('\n')[0], w); }
  for (const line of [...oa, ...orc, ...ss, ...cr]) { const u = line.match(/https?:\/\/[^\s)]+/)?.[0]; if (u) add('scholarly record', u, line.split('\n')[0].slice(0, 120), line); }
  for (const t of read.texts) {
    const u = t.match(/^PAGE (\S+)/)?.[1];
    if (!u) continue;
    const kind = seedUrls.has(normUrl(u)) ? 'your confirmed page' : ownPages.has(normUrl(u)) ? 'own site page' : 'page';
    add(kind, u, t.match(/\nTitle: (.*)/)?.[1] || u, t.split('\n').slice(1).join('\n'), kind === 'own site page' ? { selfAuthored: true } : {});
  }
  for (const n of news.lines) { const parts = n.split(' | '); const u = parts[parts.length - 1]; add('news', u, parts[0], `${parts[0]} (${parts[1]}, ${parts[2]})`, { published: parts[2] }); }
  for (const l of socials) add('social profile', l.url, `${l.platform} profile`, `${l.platform} profile. ${l.evidence}`);
  for (const y of yt) { const u = y.match(/https?:\/\/\S+$/)?.[0]; if (u) add('video', u, y.slice(0, 100), y); }
  for (const g of gh) { const u = g.match(/https?:\/\/\S+$/)?.[0]; if (u) add('code profile', u, g.slice(0, 100), g); }
  for (const d of domains.lines) { const u = d.match(/https?:\/\/[^\s|]+/)?.[0]; if (u) add('page', u, d.split('|')[1]?.trim() || u, d); }
  for (const h of hits) add('search result', h.url, h.title, `${h.title}. ${h.snippet}`);
  const peerRegister: string[] = [];
  for (const h of peers) {
    const before = register.length;
    add('peer research', h.url, h.title, `${h.title}. ${h.snippet}`, { selfAuthored: false });
    if (register.length > before) peerRegister.push(register[register.length - 1].id);
  }

  // Context for the model: grouped, every item carries its source id
  const group = (title: string, kinds: string[]) => {
    const items = register.filter((r) => kinds.includes(r.kind) && !(kinds[0] === 'peer research' ? false : peerRegister.includes(r.id)));
    if (!items.length) return '';
    return `${title}\n` + items.map((r) => `[${r.id}] ${r.title}\nKind: ${r.kind}${r.flags.length ? ` | Warnings: ${r.flags.join('; ')}` : ''}\nURL: ${r.url}\n${corpus[r.id]}`).join('\n\n');
  };
  const sections = [
    group('PAGES THE USER CONFIRMED ARE THEIR OWN OR ABOUT THEM, AND OTHER PAGES OF THE SAME SITES (read in full):', ['your confirmed page', 'own site page']),
    group('ENCYCLOPEDIA:', ['encyclopedia']),
    group('SCHOLARLY RECORDS (OpenAlex, ORCID, Semantic Scholar, Crossref):', ['scholarly record']),
    group('FULL PAGES READ:', ['page']),
    group('NEWS (Google News headlines):', ['news']),
    group('SOCIAL AND VIDEO PROFILES FOUND (check they are the same person):', ['social profile', 'video', 'code profile']),
    group('SEARCH RESULTS (snippets only):', ['search result']),
    peerRegister.length ? `POSSIBLE PEERS (other people working in "${field}"; use only to find comparable experts):\n` + peerRegister.map((id) => { const r = register.find((x) => x.id === id)!; return `[${r.id}] ${r.title}\nURL: ${r.url}\n${corpus[r.id]}`; }).join('\n\n') : '',
  ].filter(Boolean);

  let context = sections.join('\n\n=====\n\n');
  if (context.length > maxChars) context = context.slice(0, maxChars) + '\n[truncated]';

  const sources = register.map((r) => ({ title: r.title, url: r.url }));
  const CHECKED = ['LinkedIn', 'Facebook', 'Instagram', 'TikTok', 'X / Twitter', 'YouTube', 'Discord', 'Reddit'];
  const found = new Set(socials.map((l) => l.platform));
  const coverage: ResearchCoverage = {
    sourcesUsed: register.length,
    pagesRead: read.texts.length,
    platformsFound: CHECKED.filter((p) => found.has(p)),
    platformsNotFound: CHECKED.filter((p) => !found.has(p)),
    searchLimited: jobs.length > 0 && engineFailures / jobs.length > 0.5,
  };

  return {
    register,
    corpus,
    coverage,
    context,
    sources,
    socials,
    stats: {
      queries: jobs.length,
      failedQueries: engineFailures,
      hits: hits.length,
      registered: register.length,
      news: news.lines.length,
      scholarly: oa.length + orc.length + ss.length + cr.length,
      youtube: yt.length,
      domains: domains.sources.length,
      pagesRead: read.texts.length,
      peers: peerRegister.length,
      socials: socials.length,
      ...Object.fromEntries(Object.entries(perEngine).flatMap(([k, v]) => [[`${k}Ok`, v.ok], [`${k}Empty`, v.empty]])),
    },
  };
}
