// Keyless deep research: several search engines, site-specific searches (LinkedIn, YouTube, Scholar...),
// news, academic and encyclopedia APIs, name-based domain discovery and full-page reading.
// Everything is gathered on the server and handed to the model as text.
import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import { safeFetchText } from './safe-fetch';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface ResearchInput {
  name: string;
  affiliation?: string;
  domain?: string;
  // 'profiles' skips reading full pages so the profile list comes back faster
  depth?: 'profiles' | 'deep';
}

export interface ResearchPack {
  context: string;
  sources: { title: string; url: string }[];
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
  (engineState[name] ||= { nextAt: 0, blockedUntil: 0 }).blockedUntil = Date.now() + 10 * 60_000;
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

async function readPages(urls: string[]): Promise<string[]> {
  const rows = await pool(urls, 5, async (u) => {
    const page = await safeFetchText(u, { timeoutMs: 9000 });
    if (!page || !/html/i.test(page.contentType)) return '';
    const $ = cheerio.load(page.text);
    $('script, style, nav, footer, header, aside, form, noscript, svg').remove();
    const title = clean($('title').first().text());
    const desc = clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '');
    const heads = $('h1, h2, h3').slice(0, 8).map((_, e) => clean($(e).text())).get().filter(Boolean).join(' / ');
    const paras = $('p').map((_, e) => clean($(e).text())).get().filter((p) => p.length > 60).join(' ').slice(0, 2200);
    if (!title && !paras) return '';
    return `PAGE ${page.finalUrl}\nTitle: ${title}${desc ? `\nDescription: ${desc.slice(0, 300)}` : ''}${heads ? `\nHeadings: ${heads.slice(0, 400)}` : ''}\nText: ${paras}`;
  });
  return rows.filter(Boolean);
}

// ---------- Orchestration ----------

export async function gatherResearch(input: ResearchInput, maxChars = 70_000): Promise<ResearchPack> {
  const { name, affiliation, domain } = input;
  const deep = input.depth !== 'profiles';
  const q = `"${name}"`;
  const extra = [affiliation, domain].filter(Boolean).join(' ');

  // Few, well-chosen queries: scraped engines throttle bursts, and a throttled engine returns junk
  const queries = [
    q,
    ...(extra ? [`${q} ${extra}`] : []),
    // Social platforms are always searched
    `${q} site:linkedin.com/in`,
    `${q} site:facebook.com`,
    `${q} site:instagram.com OR site:tiktok.com`,
    `${q} site:youtube.com`,
    `${q} site:x.com OR site:twitter.com OR site:threads.net`,
    `${q} discord OR site:discord.com OR site:discord.gg`,
    `${q} site:reddit.com OR site:quora.com`,
    // Academic, press and reputation
    `${q} site:scholar.google.com OR site:researchgate.net`,
    `${q} interview podcast keynote`,
    `${q} award university education`,
    ...(deep ? [`${q} reviews testimonials`, `${q} news`] : []),
  ];

  const jobs: { engine: (typeof ENGINES)[number]; query: string }[] = queries.flatMap((query) => ENGINES.map((engine) => ({ engine, query })));
  const hitMap = new Map<string, Hit>();
  let engineFailures = 0;
  const perEngine: Record<string, { ok: number; empty: number }> = {};
  const junk: Record<string, number> = {};

  const structured = Promise.all([
    wikipedia(name), openAlex(name, affiliation), orcid(name), semanticScholar(name), crossref(name), github(name), googleNews(name), candidateDomains(name),
  ]);

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
      junk[asked] = (junk[asked] || 0) + 1;
      if (junk[asked] >= 3) markBlocked(asked);
    }
    if (results.length) rec.ok++; else rec.empty++;
    if (!results.length) engineFailures++;
    for (const r of results) {
      const key = r.url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
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
    let s = h.engines.size * 2;
    if (tokens.every((t) => hay.includes(t))) s += 4;
    else if (lastToken && hay.includes(lastToken)) s += 1;
    else s -= 5;
    if (affiliation && hay.includes(affiliation.toLowerCase().split(' ')[0])) s += 2;
    return s;
  };
  const hits = [...hitMap.values()].filter((h) => score(h) > 0).sort((a, b) => score(b) - score(a)).slice(0, 60);

  const [wiki, oa, orc, ss, cr, gh, news, domains] = await structured;
  const yt = await youtubeInfo(hits.map((h) => h.url));

  let pages: string[] = [];
  if (deep) {
    const seen = new Set<string>();
    const toRead = hits
      .filter((h) => {
        let host = '';
        try { host = new URL(h.url).hostname.replace(/^www\./, ''); } catch { return false; }
        if (UNREADABLE.test(host) || seen.has(host)) return false;
        seen.add(host);
        return true;
      })
      .slice(0, 10)
      .map((h) => h.url);
    pages = await readPages(toRead);
  }

  const sections: string[] = [];
  sections.push(`SEARCH HITS (${hits.length}, ranked by relevance and by how many engines returned them):\n` +
    hits.map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\nFound by: ${[...h.engines].join(', ')}\n${h.snippet}`).join('\n\n'));
  if (wiki.length) sections.push(`ENCYCLOPEDIA:\n${wiki.join('\n')}`);
  const academic = [...oa, ...orc, ...ss, ...cr];
  if (academic.length) sections.push(`SCHOLARLY RECORDS (OpenAlex, ORCID, Semantic Scholar, Crossref; Google Scholar profiles appear in the search hits when public):\n${academic.join('\n')}`);
  if (news.lines.length) sections.push(`NEWS COVERAGE (Google News):\n${news.lines.join('\n')}`);
  if (yt.length) sections.push(`YOUTUBE:\n${yt.join('\n')}`);
  if (gh.length) sections.push(`CODE PROFILES:\n${gh.join('\n')}`);
  if (domains.lines.length) sections.push(`DOMAINS NAMED AFTER THE PERSON:\n${domains.lines.join('\n')}`);
  if (pages.length) sections.push(`FULL PAGE EXCERPTS:\n${pages.join('\n\n')}`);

  let context = sections.join('\n\n=====\n\n');
  if (context.length > maxChars) context = context.slice(0, maxChars) + '\n[truncated]';

  const sources: { title: string; url: string }[] = [
    ...hits.map((h) => ({ title: h.title || h.url, url: h.url })),
    ...news.sources,
    ...domains.sources,
  ];
  const seenUrl = new Set<string>();
  const uniqueSources = sources.filter((s) => !seenUrl.has(s.url) && seenUrl.add(s.url));

  return {
    context,
    sources: uniqueSources,
    stats: {
      queries: jobs.length,
      failedQueries: engineFailures,
      hits: hits.length,
      news: news.lines.length,
      scholarly: academic.length,
      youtube: yt.length,
      domains: domains.sources.length,
      pagesRead: pages.length,
      ...Object.fromEntries(Object.entries(perEngine).flatMap(([k, v]) => [[`${k}Ok`, v.ok], [`${k}Empty`, v.empty]])),
    },
  };
}
