import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';
import { AiError, readAiConfig, runModel, serverProviders, type AiConfig } from './ai';
import { gatherResearch } from './research';
import { buildPrompt, buildReport } from './analysis';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';
import { assertPublicUrl } from './safe-fetch';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Behind Render's proxy, so per-IP rate limiting sees the real client address
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Minimal in-memory rate limiter for the /api routes (per IP, per minute)
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 60;
const hits = new Map<string, { count: number; reset: number }>();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 });
    return next();
  }
  if (++entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests, please slow down.' });
  }
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 60_000).unref();

// Which providers the server has keys for (names only, never the keys)
app.get('/api/config', (_req, res) => res.json({ providers: serverProviders() }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ExpertScan', timestamp: new Date().toISOString() });
});

export interface ScrapedWebsiteData {
  url: string;
  domain: string;
  platform: string;
  title: string;
  snippet: string;
  headings?: string[];
  bodySnippets?: string[];
  extractedQuotes?: string[];
  audienceReactions?: string[];
  keySignals?: string[];
  isSocialNetwork?: boolean;
  scrapedAt?: string;
}

// Discovered Website Interface
interface DiscoveredWebsite {
  id: string;
  title: string;
  url: string;
  platform: string;
  domain: string;
  snippet: string;
  isConfirmed: boolean;
  associationReason: string;
  isPotentialCollision?: boolean;
  needsReview?: boolean;
  isCustomAdded?: boolean;
  scrapedData?: ScrapedWebsiteData;
}

export type DiscoveryCategory =
  | 'websites'
  | 'credentials'
  | 'education'
  | 'awards'
  | 'publications'
  | 'interviews'
  | 'articles';

export interface DiscoveredFactItem {
  id: string;
  category: DiscoveryCategory;
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  dateOrYear?: string;
  isConfirmed: boolean;
  isPotentialCollision?: boolean;
  isCustomAdded?: boolean;
  sourceOrigin?: string;
  websiteData?: DiscoveredWebsite;
}

// Shared helpers
function extractJson(text: string, open: '{' | '['): any {
  const close = open === '{' ? '}' : ']';
  const first = text.indexOf(open);
  const last = text.lastIndexOf(close);
  if (first === -1 || last <= first) throw new Error('Model response contained no JSON');
  return parseLenient(text.substring(first, last + 1));
}

// Models sometimes slip on one comma or quote in a long answer: repair it instead of discarding everything
function parseLenient(raw: string): any {
  try { return JSON.parse(raw); } catch { return JSON.parse(jsonrepair(raw)); }
}

// Maps AI/provider failures to a JSON response the client can show
function sendAiError(res: express.Response, err: unknown, fallback: string) {
  if (err instanceof AiError) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(fallback, err instanceof Error ? err.message : err);
  return res.status(502).json({ error: fallback });
}

// Search online profiles, associated websites and background facts (live web search via the visitor's AI provider)
app.get('/api/search-profiles', async (req, res) => {
  const name = (req.query.name as string || '').trim();
  const affiliation = (req.query.affiliation as string || '').trim();
  const domain = (req.query.domain as string || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Name is required to search public profiles' });
  }

  let ai: AiConfig;
  try { ai = readAiConfig(req.headers); } catch (e) { return sendAiError(res, e, 'AI not configured'); }

  try {
    const prompt = `Perform a live web search for the public professional footprint of "${name}"${affiliation ? ` affiliated with "${affiliation}"` : ''}${domain ? ` working in "${domain}"` : ''}.
Find up to 12 candidate public URLs for this person. Always look for and include, when they exist: LinkedIn, Facebook, Instagram, TikTok, X/Twitter, YouTube, Discord, Reddit, Google Scholar, plus Wikipedia, corporate or personal websites, new or lesser-known domains, speaker profiles and directories. Do not invent a profile for a platform where nothing was found.
Also flag any URL that probably belongs to a different person with the same name (name collision).
Then collect verifiable background facts. Only include facts you found in real sources, with the real source URL. If you find nothing for a category, return an empty array. Never invent anything.

Respond STRICTLY with one JSON object and no markdown:
{
  "websites": [
    { "title": "Display title", "url": "https://...", "platform": "LinkedIn", "snippet": "Short description of the page", "isPotentialCollision": false }
  ],
  "facts": [
    { "category": "credentials | education | awards | publications | interviews | articles", "title": "...", "subtitle": "...", "description": "...", "dateOrYear": "...", "url": "https://source...", "sourceOrigin": "..." }
  ]
}`;

    const response = await runModel(ai, prompt, true, [name, affiliation, domain].filter(Boolean).join(' '), { name, affiliation, domain, depth: 'profiles' });
    const parsed = extractJson(response.text, '{');

    const websites: DiscoveredWebsite[] = (Array.isArray(parsed.websites) ? parsed.websites : [])
      .filter((item: any) => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url))
      .map((item: any, idx: number) => {
        let host = 'web';
        try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
        return {
          id: `web-${idx}-${Date.now()}`,
          title: item.title || `${name} public link`,
          url: item.url,
          domain: host,
          platform: item.platform || 'Public Web Profile',
          snippet: item.snippet || '',
          isConfirmed: !item.isPotentialCollision,
          associationReason: item.isPotentialCollision
            ? 'Potential name collision: this link may belong to a different person with a similar name'
            : 'Live web search match',
          isPotentialCollision: Boolean(item.isPotentialCollision),
        };
      });

    // Guarantee the social platforms are represented, whatever the model kept or dropped
    const enc = encodeURIComponent(name);
    const PLATFORMS: { label: string; host: RegExp; profile: RegExp; search: string }[] = [
      { label: 'LinkedIn', host: /(^|\.)linkedin\.com$/, profile: /\/(in|pub)\//, search: `https://www.linkedin.com/search/results/people/?keywords=${enc}` },
      { label: 'Facebook', host: /(^|\.)facebook\.com$/, profile: /^\/(?!search|public|watch|groups\/?$)[^/]+/, search: `https://www.facebook.com/search/people/?q=${enc}` },
      { label: 'Instagram', host: /(^|\.)instagram\.com$/, profile: /^\/(?!explore|p\/|reel)[^/]+/, search: `https://www.instagram.com/explore/search/keyword/?q=${enc}` },
      { label: 'TikTok', host: /(^|\.)tiktok\.com$/, profile: /^\/@/, search: `https://www.tiktok.com/search/user?q=${enc}` },
      { label: 'X / Twitter', host: /(^|\.)(x|twitter)\.com$/, profile: /^\/(?!search|hashtag|i\/)[^/]+$/, search: `https://x.com/search?q=${enc}&f=user` },
      { label: 'YouTube', host: /(^|\.)youtube\.com$/, profile: /^\/(@|channel\/|c\/|user\/)/, search: `https://www.youtube.com/results?search_query=${enc}&sp=EgIQAg%253D%253D` },
      { label: 'Discord', host: /(^|\.)discord\.(com|gg)$/, profile: /./, search: `https://www.google.com/search?q=${encodeURIComponent(`"${name}" discord`)}` },
      { label: 'Reddit', host: /(^|\.)reddit\.com$/, profile: /^\/(user|u)\//, search: `https://www.reddit.com/search/?q=${enc}&type=user` },
      { label: 'Google Scholar', host: /(^|\.)scholar\.google\./, profile: /citations/, search: `https://scholar.google.com/scholar?q=${enc}` },
    ];
    const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const pathOf = (u: string) => { try { return new URL(u).pathname; } catch { return ''; } };
    // Profiles found by the keyless discovery (Wikidata, Wikipedia, own sites, YouTube, Bluesky, search results)
    const normUrl = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/^twitter\.com/, 'x.com').replace(/\/+$/, '');
    for (const soc of response.socials || []) {
      if (websites.some((w) => normUrl(w.url) === normUrl(soc.url))) continue;
      websites.push({
        id: `web-${soc.platform}-${websites.length}-${Date.now()}`,
        title: `${soc.platform} profile`,
        url: soc.url,
        domain: hostOf(soc.url),
        platform: soc.platform,
        snippet: soc.evidence,
        isConfirmed: true,
        needsReview: true,
        associationReason: soc.evidence,
      });
    }
    for (const pf of PLATFORMS) {
      const alreadyListed = websites.some((w) => pf.host.test(hostOf(w.url)));
      if (alreadyListed) continue;
      // A profile the search engines returned but the model left out
      const found = response.sources.find((src) => pf.host.test(hostOf(src.url)) && pf.profile.test(pathOf(src.url)));
      if (found) {
        websites.push({
          id: `web-${pf.label}-found-${Date.now()}`,
          title: found.title || `${pf.label} result for ${name}`,
          url: found.url,
          domain: hostOf(found.url),
          platform: pf.label,
          snippet: 'Found by web search on this platform.',
          isConfirmed: true,
          needsReview: true,
          associationReason: 'Found by search engines, not yet verified',
        });
      } else {
        websites.push({
          id: `web-${pf.label}-search-${Date.now()}`,
          title: `Search ${pf.label} for ${name}`,
          url: pf.search,
          domain: hostOf(pf.search),
          platform: pf.label,
          snippet: `No ${pf.label} profile was found automatically. Open this search to look yourself, then add the profile link as a custom page.`,
          isConfirmed: false,
          associationReason: 'Not found automatically: manual check link',
        });
      }
    }

    // Every social profile is added for the user to review, since people share names
    for (const w of websites) {
      if (PLATFORMS.some((pf) => pf.label !== 'Google Scholar' && pf.host.test(hostOf(w.url))) && !w.id.includes('-search-')) w.needsReview = true;
    }

    const categories: DiscoveryCategory[] = ['credentials', 'education', 'awards', 'publications', 'interviews', 'articles'];
    const grouped: Record<string, DiscoveredFactItem[]> = {};
    categories.forEach((c) => (grouped[c] = []));
    (Array.isArray(parsed.facts) ? parsed.facts : []).forEach((f: any, idx: number) => {
      if (!f || !f.title || !categories.includes(f.category)) return;
      grouped[f.category].push({
        id: `fact-${f.category}-${idx}-${Date.now()}`,
        category: f.category,
        title: f.title,
        subtitle: f.subtitle,
        description: f.description,
        dateOrYear: f.dateOrYear,
        url: typeof f.url === 'string' && /^https?:\/\//i.test(f.url) ? f.url : undefined,
        sourceOrigin: f.sourceOrigin,
        isConfirmed: true,
      });
    });

    return res.json({
      success: true,
      websites,
      profiles: websites,
      credentials: grouped.credentials,
      education: grouped.education,
      awards: grouped.awards,
      publications: grouped.publications,
      interviews: grouped.interviews,
      articles: grouped.articles,
    });
  } catch (err: any) {
    return sendAiError(res, err, 'Live profile search failed. Please try again.');
  }
});

// Live Web Scraping function for LinkedIn, Facebook, and any website
async function scrapeWebsiteContent(targetUrl: string, subjectName: string = '', ai: AiConfig): Promise<ScrapedWebsiteData> {
  let domain = 'web';
  try {
    domain = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = targetUrl.replace(/^https?:\/\//, '').split('/')[0] || 'web';
  }

  const lowerUrl = targetUrl.toLowerCase();
  const isLinkedIn = lowerUrl.includes('linkedin.com');
  const isFacebook = lowerUrl.includes('facebook.com');
  const isScholar = lowerUrl.includes('scholar.google');
  const isYouTube = lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
  const isTwitter = lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com');
  const isMedium = lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com');

  let platform = 'Web Platform';
  if (isLinkedIn) platform = 'LinkedIn Profile';
  else if (isFacebook) platform = 'Facebook Public Page';
  else if (isScholar) platform = 'Google Scholar Profile';
  else if (isYouTube) platform = 'YouTube Video / Channel';
  else if (isTwitter) platform = 'X / Twitter Feed';
  else if (isMedium) platform = 'Articles & Substack';

  let pageTitle = `${subjectName ? `${subjectName} - ` : ''}${platform}`;
  let pageSnippet = `Public web profile on ${domain}.`;
  let headings: string[] = [];
  let bodySnippets: string[] = [];
  let extractedQuotes: string[] = [];
  let audienceReactions: string[] = [];
  let keySignals: string[] = [];

  // 1. Direct HTTP fetch attempt
  let fetchedHtml = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const reqHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    let currentUrl = targetUrl;
    let resp: Response;
    for (let hop = 0; ; hop++) {
      await assertPublicUrl(currentUrl);
      resp = await fetch(currentUrl, { redirect: 'manual', signal: controller.signal, headers: reqHeaders });
      const loc = resp.headers.get('location');
      if (resp.status >= 300 && resp.status < 400 && loc && hop < 4) {
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }
      break;
    }
    clearTimeout(timer);
    if (resp.ok) {
      fetchedHtml = await resp.text();
    }
  } catch (err) {
    // Non-fatal, fallback to AI grounding or heuristics
  }

  if (fetchedHtml && fetchedHtml.length > 80) {
    try {
      const $ = cheerio.load(fetchedHtml);
      const titleTag = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
      if (titleTag) pageTitle = titleTag;

      const descTag =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';
      if (descTag) pageSnippet = descTag;

      headings = $('h1, h2, h3')
        .slice(0, 6)
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((t) => t.length > 3 && t.length < 180);

      bodySnippets = $('p, article, .content, .description, .summary, .about, .bio')
        .slice(0, 8)
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((t) => t.length > 25 && t.length < 400);

      extractedQuotes = $('blockquote, q, .quote, .testimonial, .comment')
        .slice(0, 5)
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((t) => t.length > 10 && t.length < 300);
    } catch {
      // ignore parse error
    }
  }

  // 2. For social platforms (LinkedIn, Facebook) or sparse content, use AI web search to extract public posts & comments
  if (ai && (isLinkedIn || isFacebook || bodySnippets.length < 2)) {
    try {
      const searchPrompt = `You are a live web research engine for ExpertScan.
The user wants to scrape live public content, profile bio, headline, and audience reactions/comments from this URL:
Target URL: "${targetUrl}"
Platform: "${platform}"
${subjectName ? `Person/Subject Name: "${subjectName}"` : ''}

Use web search to perform targeted searches for the exact contents, public bio, posts, and audience comments of this page.
Extract:
1. Exact Page Title or Professional Headline
2. Summary / Bio excerpt
3. 2-4 actual quotes or written excerpts found on this profile/page
4. 2-4 audience comments, peer recommendations, or reaction themes
5. 2-3 key reputational signals

Respond STRICTLY with a valid JSON object in this format, with no markdown code blocks:
{
  "title": "Exact Title or Name on page",
  "snippet": "Summary of bio or description",
  "headings": ["Heading 1", "Heading 2"],
  "bodySnippets": ["Paragraph or post text excerpt 1", "Excerpt 2"],
  "extractedQuotes": ["Quote 1", "Quote 2"],
  "audienceReactions": ["Audience comment or peer recommendation 1", "Comment 2"],
  "keySignals": ["Key signal 1", "Key signal 2"]
}`;

      const aiRes = await runModel(ai, searchPrompt, true, [subjectName, targetUrl].filter(Boolean).join(' '));

      const text = aiRes.text;
      let cleaned = text.trim();
      const firstB = cleaned.indexOf('{');
      const lastB = cleaned.lastIndexOf('}');
      if (firstB !== -1 && lastB !== -1 && lastB > firstB) {
        cleaned = cleaned.substring(firstB, lastB + 1);
      }
      const parsed = JSON.parse(cleaned);
      if (parsed.title) pageTitle = parsed.title;
      if (parsed.snippet) pageSnippet = parsed.snippet;
      if (Array.isArray(parsed.headings) && parsed.headings.length) headings = parsed.headings;
      if (Array.isArray(parsed.bodySnippets) && parsed.bodySnippets.length) bodySnippets = parsed.bodySnippets;
      if (Array.isArray(parsed.extractedQuotes) && parsed.extractedQuotes.length) extractedQuotes = parsed.extractedQuotes;
      if (Array.isArray(parsed.audienceReactions) && parsed.audienceReactions.length) audienceReactions = parsed.audienceReactions;
      if (Array.isArray(parsed.keySignals) && parsed.keySignals.length) keySignals = parsed.keySignals;
    } catch (aiErr) {
      if (aiErr instanceof AiError && aiErr.code === 'BAD_API_KEY') throw aiErr;
      console.warn(`AI scrape fallback failed for ${targetUrl}:`, aiErr instanceof Error ? aiErr.message : aiErr);
    }
  }

  return {
    url: targetUrl,
    domain,
    platform,
    title: pageTitle,
    snippet: pageSnippet,
    headings,
    bodySnippets,
    extractedQuotes,
    audienceReactions,
    keySignals,
    isSocialNetwork: Boolean(isLinkedIn || isFacebook || isTwitter),
    scrapedAt: new Date().toISOString(),
  };
}

// Endpoint to scrape a specific URL and extract preview content
app.post('/api/scrape-url', async (req, res) => {
  const { url, name } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  let ai: AiConfig;
  try { ai = readAiConfig(req.headers); } catch (e) { return sendAiError(res, e, 'AI not configured'); }

  try {
    const scraped = await scrapeWebsiteContent(cleanUrl, (name || '').trim(), ai);
    return res.json({ success: true, data: scraped });
  } catch (err: any) {
    return sendAiError(res, err, 'Failed to scrape URL');
  }
});


// Evidence-based report: research first, then the AI writes from numbered sources, then the server checks every claim
app.post('/api/analyze-presence', async (req, res) => {
  const { name, domain, affiliation, verifiedWebsites, excludedWebsites, selfAssessment } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'A name is required.' });
  }
  const cleanName = name.trim().slice(0, 120);

  let ai: AiConfig;
  try { ai = readAiConfig(req.headers); } catch (e) { return sendAiError(res, e, 'AI not configured'); }

  // Reports can take minutes. Send headers now and a space every 15s so proxies and tunnels
  // (which cut idle responses after ~100s) keep the connection open. Leading whitespace is valid JSON.
  res.status(200).type('json');
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(' '), 15_000);
  res.on('close', () => clearInterval(keepAlive));
  const finish = (body: unknown) => { clearInterval(keepAlive); res.end(JSON.stringify(body)); };

  try {
    const sites = (v: unknown): any[] => (Array.isArray(v) ? v.filter((w) => w && typeof w.url === 'string') : []);
    const seeds = sites(verifiedWebsites).slice(0, 25).map((w) => {
      const d = w.scrapedData || {};
      const scraped = [d.snippet, ...(d.headings || []), ...(d.bodySnippets || []), ...(d.extractedQuotes || []), ...(d.audienceReactions || [])]
        .filter((x: unknown) => typeof x === 'string' && x).join('\n').slice(0, 2600);
      return { url: w.url, title: typeof w.title === 'string' ? w.title : undefined, platform: typeof w.platform === 'string' ? w.platform : undefined, scraped };
    });
    const excluded = sites(excludedWebsites).slice(0, 50).map((w) => ({ title: String(w.title || w.url), url: w.url }));
    const answers = (Array.isArray(selfAssessment) ? selfAssessment : []).slice(0, 6).map((a: any) => ({
      question: String(a?.question || '').slice(0, 200), answer: String(a?.answer || '').slice(0, 700),
    })).filter((a) => a.question);

    const pack = await gatherResearch(
      { name: cleanName, affiliation: affiliation?.trim(), domain: domain?.trim(), field: domain?.trim(), seeds, excludeUrls: excluded.map((e) => e.url), depth: 'deep' },
      ai.provider === 'free' ? 9000 : 70_000,
    );
    console.log('research:', cleanName, JSON.stringify(pack.stats));
    if (!pack.register.length) {
      return finish({ error: 'Web search is temporarily unavailable. Please try again in a few minutes.', code: 'SEARCH_UNAVAILABLE' });
    }

    // The person's own answers become a numbered source so they can be cited as self-reported
    let selfSourceId: string | undefined;
    const given = answers.filter((a) => a.answer.trim());
    if (given.length) {
      selfSourceId = `S${pack.register.length + 1}`;
      const text = given.map((a) => `${a.question} ${a.answer}`).join('\n');
      pack.register.push({
        id: selfSourceId, url: 'about:self-assessment', title: 'Your own answers to the optional questions', kind: 'self-assessment',
        selfAuthored: true, accessedAt: new Date().toISOString().slice(0, 10), excerpt: text.slice(0, 400), flags: ['Written by the person themself'],
      });
      pack.corpus[selfSourceId] = text;
    }

    const prompt = buildPrompt({ name: cleanName, affiliation: affiliation?.trim(), domain: domain?.trim(), selfAssessment: answers, selfSourceId, excluded, context: pack.context });
    const response = await runModel(ai, prompt, false);

    let raw: any;
    try {
      raw = extractJson(response.text, '{');
    } catch (e) {
      console.warn('Could not read the model output:', e instanceof Error ? e.message : e);
      return finish({ error: "The report could not be read. Please try again." });
    }

    const report = buildReport({
      raw,
      ctx: {
        register: pack.register,
        corpus: pack.corpus,
        peerIds: new Set(pack.register.filter((r) => r.kind === 'peer research').map((r) => r.id)),
        subjectName: cleanName,
      },
      coverage: pack.coverage,
      selfAssessmentGiven: answers.some((a) => a.answer.trim().length > 0),
      fallbackField: domain?.trim() || '',
    });
    return finish({ success: true, data: report, source: ai.provider });
  } catch (err) {
    if (err instanceof AiError) return finish({ error: err.message, code: err.code });
    console.error('Analysis failed:', err instanceof Error ? err.message : err);
    return finish({ error: 'Live analysis failed. Please try again.' });
  }
});


// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExpertScan server running on port ${PORT}`);
  });
}

startServer();
