import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import net from 'node:net';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

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

// Block server-side requests to private/internal addresses (SSRF protection)
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
}
async function assertPublicUrl(raw: string): Promise<void> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.some(a => isPrivateIp(a.address))) throw new Error('URL resolves to a private address');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FELIXA Behavioral Intelligence Engine', timestamp: new Date().toISOString() });
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
  return JSON.parse(text.substring(first, last + 1));
}

const NO_KEY_ERROR = {
  error: 'GEMINI_API_KEY is not configured on the server. Add it to .env.local and restart.',
  code: 'NO_API_KEY',
};

// Search online profiles, associated websites and background facts (live, via Gemini + Google Search)
app.get('/api/search-profiles', async (req, res) => {
  const name = (req.query.name as string || '').trim();
  const affiliation = (req.query.affiliation as string || '').trim();
  const domain = (req.query.domain as string || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Name is required to search public profiles' });
  }

  const ai = getGenAI();
  if (!ai) return res.status(503).json(NO_KEY_ERROR);

  try {
    const prompt = `Perform a live web search for the public professional footprint of "${name}"${affiliation ? ` affiliated with "${affiliation}"` : ''}${domain ? ` working in "${domain}"` : ''}.
Find 4 to 8 candidate public URLs for this person (e.g. LinkedIn, corporate website, Google Scholar, Wikipedia, Twitter/X, speaker profile, personal domain).
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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const parsed = extractJson(response.text || '', '{');

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
    console.error('Profile search failed:', err);
    return res.status(502).json({ error: 'Live profile search failed', details: err?.message || String(err) });
  }
});

// Live Web Scraping function for LinkedIn, Facebook, and any website
async function scrapeWebsiteContent(targetUrl: string, subjectName: string = ''): Promise<ScrapedWebsiteData> {
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

  // 2. For social platforms (LinkedIn, Facebook) or sparse content, use Gemini with Google Search tool to extract public posts & comments
  const ai = getGenAI();
  if (ai && (isLinkedIn || isFacebook || bodySnippets.length < 2)) {
    try {
      const searchPrompt = `You are a live web scraping engine for the FELIXA Public Perception Mirror.
The user wants to scrape live public content, profile bio, headline, and audience reactions/comments from this URL:
Target URL: "${targetUrl}"
Platform: "${platform}"
${subjectName ? `Person/Subject Name: "${subjectName}"` : ''}

Use the googleSearch tool to perform targeted searches for the exact contents, public bio, posts, and audience comments of this page.
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

      const aiRes = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: searchPrompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text = aiRes.text || '';
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
      console.warn(`Live Gemini scrape fallback error for ${targetUrl}:`, aiErr);
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

  try {
    const scraped = await scrapeWebsiteContent(cleanUrl, (name || '').trim());
    return res.json({ success: true, data: scraped });
  } catch (err: any) {
    console.error(`Error scraping URL ${cleanUrl}:`, err);
    return res.status(500).json({ error: 'Failed to scrape URL', details: err?.message || String(err) });
  }
});


// Initialize GoogleGenAI client lazily or when key exists
let genAIClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return genAIClient;
}

// Behavioral Intelligence Analysis Endpoint
app.post('/api/analyze-presence', async (req, res) => {
  const {
    name,
    selfPerception,
    domain,
    educationSchools,
    workExperience,
    awardsAccolades,
    problemsChallenges,
    publicUrl,
    primaryMedium,
    affiliation,
    communicationPosture,
    verifiedWebsites,
    excludedWebsites,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required for behavioral research' });
  }

  const cleanName = name.trim();
  const resolvedDomain = domain?.trim() || 'Not specified (discover from sources)';
  const resolvedAffiliation = affiliation?.trim() || 'Not specified (discover from sources)';

  const ai = getGenAI();
  if (!ai) return res.status(503).json(NO_KEY_ERROR);

  {
    try {
      const prompt = `You are the FELIXA Public Perception Mirror for Experts, Leaders, and Professionals.
FELIXA's mission is: "FELIXA helps bring out the best in people."
The user wants a friendly, constructive, and accurate mirror that shows:
"How people see you vs. how you perceive yourself."

CRITICAL USER MANDATE:
1. The user has supplied ONLY their name: "${cleanName}" ${resolvedAffiliation ? `(affiliated with "${resolvedAffiliation}")` : ''} ${resolvedDomain ? `(domain "${resolvedDomain}")` : ''}.
2. NEVER ask questions such as "who do you think you are", and do not require any self-assessment answers from the user!
3. Based on this name alone, use the googleSearch tool to perform an exhaustive, multi-step search across the web to discover, extract, and ground ALL of the following:
   - Self-Presentation & Account of What This Person Thinks of Themselves: Search across multiple online sources: social media profiles (LinkedIn "About", Facebook page bio, Twitter/X bio), podcast/video interviews, keynote transcripts, and authored articles/op-eds. Analyze how "${cleanName}" describes herself/themselves in their own words. What is their claimed mission, values, personal identity, and underlying philosophy?
   - Evaluate Comments & Public Reactions: Search and evaluate actual comments under their posts, published articles, and recorded interviews (e.g. comments on LinkedIn posts, reactions on Facebook, YouTube video comments, forum discussions). What do commenters praise? What do peers or skeptics debate? What do audience reactions reveal about public reality versus how the person described themselves?
   - Education & Schools: Search for their actual university degrees, alma maters, PhD/Master's/Bachelor's degrees, faculties, theses, and academic honors.
   - Work Experience: Search for their career timeline, companies founded or led, executive positions, and key milestones throughout the years.
   - Awards & Accolades: Search for public honors, rector's awards, grants, fellowships, and recognized accolades.
   - Problems & Challenges: Search for tough hurdles, industry skepticism, misconceptions, or regulatory/technical obstacles they navigated and overcame.
   - Longitudinal Evolution: How their public reputation has evolved across early career, rise to domain recognition, and current era.
   - The Perception Mirror: Contrast how they present themselves (their claimed persona and aspirations) with what the public actually sees, comments on, and values.
4. Tone & Language: Do NOT use the word "forensic" or anything related to that. Make this app sound friendly, supportive, constructive, and clear.
5. All information MUST be 100% accurate, strictly grounded in authentic sources.

Subject Profile:
- Name: "${cleanName}"
- Known Specialty / Domain: "${resolvedDomain}"
- Known Affiliation: "${resolvedAffiliation}"
- Self-Perception Provided By User: None (discover autonomously from their own self-authored bios/site/LinkedIn)
- Education Provided By User: None (discover autonomously from university/school records)
- Work Experience Provided By User: None (discover autonomously from career trajectory)
- Awards Provided By User: None (discover autonomously from public honors)
- Problems/Challenges Provided By User: None (discover autonomously from industry hurdles)
${
  Array.isArray(verifiedWebsites) && verifiedWebsites.length > 0
    ? `- CONFIRMED AUTHENTIC WEBSITES & SCRAPED SIGNALS (Reviewed & Verified by user):\n${verifiedWebsites.map((w: any) => {
        let line = `  * ${w.title} (${w.url}) [Platform: ${w.platform}]`;
        if (w.scrapedData) {
          if (w.scrapedData.snippet) line += `\n    - Scraped Summary: ${w.scrapedData.snippet}`;
          if (w.scrapedData.headings && w.scrapedData.headings.length) line += `\n    - Headings: ${w.scrapedData.headings.join(' | ')}`;
          if (w.scrapedData.extractedQuotes && w.scrapedData.extractedQuotes.length) line += `\n    - Scraped Quotes/Posts: ${w.scrapedData.extractedQuotes.join('; ')}`;
          if (w.scrapedData.audienceReactions && w.scrapedData.audienceReactions.length) line += `\n    - Scraped Comments/Reactions: ${w.scrapedData.audienceReactions.join('; ')}`;
          if (w.scrapedData.keySignals && w.scrapedData.keySignals.length) line += `\n    - Key Scraped Signals: ${w.scrapedData.keySignals.join('; ')}`;
        }
        return line;
      }).join('\n')}`
    : ''
}
${
  Array.isArray(excludedWebsites) && excludedWebsites.length > 0
    ? `- CRITICAL EXCLUDED ENTITIES (BELONG TO SOMEONE ELSE / DIFFERENT PERSON):\n${excludedWebsites.map((w: any) => `  * EXCLUDED: ${w.title} (${w.url}) - Reason: ${w.associationReason || 'Belongs to a different individual'}`).join('\n')}\nSTRICT DIRECTIVE: DO NOT attribute any publications, background, credentials, or sentiment from these excluded sources to ${cleanName}!`
    : ''
}

RESEARCH & MIRROR SYNTHESIS MANDATE:
1. Use the googleSearch tool to run comprehensive searches on this person:
   - Search: "${cleanName}" "${resolvedAffiliation}"
   - Search: "${cleanName}" ${resolvedDomain}
   - Search: "${cleanName}" education university degree school thesis
   - Search: "${cleanName}" career roles founder ceo director history
   - Search: "${cleanName}" awards honors recognition fellowship
   - Search: "${cleanName}" linkedin facebook comments audience response interview talk
2. ANALYZE HOW THEY ARE SEEN THROUGHOUT THE YEARS:
   - What is revealed across Google, LinkedIn, Scholar, and public records?
   - Longitudinal Evolution: How has public perception and market understanding of this person evolved through the years?
   - Social Media & Community Responses (LinkedIn, Facebook, Industry Forums, Comments): How do peers, clients, skeptics, and followers react to their posts, talks, and ideas? Include actual quotes, comments, and sentiment themes!
   - Self-Perception vs. Public Perception (The Mirror): Compare how they present themselves in their bios with how the outside world actually perceives them across Education, Work Experience, Awards, and Challenges.
   - Build Principle - Trust & Zero Hallucination: Ground strictly in real findings.
   - Ground specifically on the confirmed authentic websites verified above!
   - Longitudinal Evolution: How has public perception and market understanding of this person evolved through the years (e.g., formative schooling/origins, early ventures, rise to recognized authority, current positioning)?
   - Social Media & Community Responses (LinkedIn, Facebook, Industry Forums, Comments): How do peers, clients, skeptics, and followers react to their posts, talks, and ideas? Include actual quotes, comments, and sentiment themes!
   - Self-Perception vs. Public Perception (The Mirror): Compare how they see themselves with how the outside world actually perceives them across Education, Work Experience, Awards, and Challenges.
   - Build Principle - Trust & Zero Hallucination: Do NOT invent fake URLs or fake facts. Ground in real findings.
3. CONTEXTUALIZE VIRTUAL PRESENCE & SOURCES TRANSPARENTLY:
   - Provide an itemized dossier of discovered sources with exact publisher, URL/platform, category, verifiable finding/evidence, and perceptual impact.

Respond strictly with a JSON object in this exact schema:
{
  "subjectName": "${name}",
  "primaryArchetype": "e.g. The Rigorous Pioneer / The Stealth Domain Authority / The Architectural Strategist",
  "archetypeTagline": "A concise 1-sentence descriptor of their public perception",
  "outerImpression": "3-4 sentences on how a high-stakes prospective buyer or audience perceives them within 60 seconds of discovering their presence online.",
  "mirrorGap": "Analysis of the contrast: how the expert likely sees their own value vs. what the market actually perceives today.",
  "overallPresenceQuotient": 78, // number between 0 and 100 representing market perception readiness
  "dimensions": [
    {
      "name": "Authority & Credibility Signaling",
      "score": 82,
      "benchmark": 85,
      "gap": -3,
      "status": "optimal",
      "description": "Specific evidence of verified credentials, publications, or public mentions.",
      "evidence": "Observed empirical evidence or gaps"
    },
    {
      "name": "Competence vs. Warmth Perception",
      "score": 75,
      "benchmark": 80,
      "gap": -5,
      "status": "moderate",
      "description": "Perceptual balance on the Fiske Stereotype Content Model (high competence vs relational warmth).",
      "evidence": "Tone and communication posture observed in their public presence"
    },
    {
      "name": "Thematic Clarity & Thesis Sharpness",
      "score": 70,
      "benchmark": 78,
      "gap": -8,
      "status": "moderate",
      "description": "How quickly an outsider understands what unique perspective they stand for.",
      "evidence": "Analysis of their public headlines, bios, and article themes"
    },
    {
      "name": "Market Pull & PR Footprint",
      "score": 64,
      "benchmark": 75,
      "gap": -11,
      "status": "critical",
      "description": "Frequency of third-party citations, media quotes, podcasts, and independent validation.",
      "evidence": "Web search volume and third-party media presence"
    },
    {
      "name": "Commercial Attractiveness & Fee Justification",
      "score": 76,
      "benchmark": 82,
      "gap": -6,
      "status": "moderate",
      "description": "How easily an enterprise decision-maker can justify paying top-tier advisory rates.",
      "evidence": "Proof points, case studies, or institutional affiliation signals"
    }
  ],
  "sentimentDistribution": {
    "positiveEndorsement": 68,
    "neutralInformational": 24,
    "criticalChallenging": 8,
    "unindexedExpertise": 35
  },
  "deepExcavation": [
    {
      "layerNumber": 1,
      "name": "Layer 1: The 60-Second Surface",
      "subtitle": "Top SERP, primary social profiles, immediate executive bio",
      "whatIsDiscovered": "What a casual visitor or prospect sees on Google Page 1",
      "perceivedGravity": "High Gravitas", // "High Gravitas" | "Moderate Alignment" | "Fragile / Understated" | "Missing"
      "friendlyInsights": ["Insight 1", "Insight 2"],
      "evidenceExcerpts": ["Verifiable quote or observation"]
    },
    {
      "layerNumber": 2,
      "name": "Layer 2: Corporate & Entity Lineage",
      "subtitle": "Company filings, boutique entities, formal advisory seats",
      "whatIsDiscovered": "Corporate registries, registered ventures, and institutional roles",
      "perceivedGravity": "High Gravitas",
      "friendlyInsights": ["Insight 1", "Insight 2"],
      "evidenceExcerpts": ["Verifiable quote or observation"]
    },
    {
      "layerNumber": 3,
      "name": "Layer 3: Scholarly Depth & Intellectual Property",
      "subtitle": "Peer-reviewed research, dissertations, whitepapers, patents, proprietary frameworks",
      "whatIsDiscovered": "The empirical foundation and academic rigor behind their advisory work",
      "perceivedGravity": "High Gravitas",
      "friendlyInsights": ["Insight 1", "Insight 2"],
      "evidenceExcerpts": ["Verifiable quote or observation"]
    },
    {
      "layerNumber": 4,
      "name": "Layer 4: Earned Media, Audio & Speeches",
      "subtitle": "Podcast guestings, panel transcripts, keynote appearances, vertical press quotes",
      "whatIsDiscovered": "How they articulate ideas in live broadcast and dialogue",
      "perceivedGravity": "Moderate Alignment",
      "friendlyInsights": ["Insight 1", "Insight 2"],
      "evidenceExcerpts": ["Verifiable quote or observation"]
    },
    {
      "layerNumber": 5,
      "name": "Layer 5: Shadow Presence & Digital Anomalies",
      "subtitle": "Outdated bios, unindexed methodologies, fragmented handles, attribution leaks",
      "whatIsDiscovered": "Gaps, missed commercial attribution, and hidden assets locked behind closed doors",
      "perceivedGravity": "Fragile / Understated",
      "friendlyInsights": ["Insight 1", "Insight 2"],
      "evidenceExcerpts": ["Verifiable quote or observation"]
    }
  ],
  "disclosedSources": [
    {
      "id": "src-1",
      "title": "Title of public document, article, or profile",
      "url": "https://...",
      "publisher": "Platform or Organization",
      "category": "Academic & Scholarly", // "Academic & Scholarly" | "Corporate & Registry" | "Media & Press" | "Speaking & Audio" | "Social & Commentary" | "Digital Archive"
      "dateOrEra": "2023 - Present",
      "discoveredEvidence": "Specific empirical fact, quote, or role verified at this source",
      "contextualSignificance": "Why this specific source matters to high-stakes observers",
      "authorityImpact": "High Credibility" // "High Credibility" | "Moderate Signal" | "Friction / Outdated" | "Untapped Asset"
    }
  ],
  "virtualPresenceMatrix": [
    {
      "channel": "Scholarly & Research Repositories",
      "maturity": "Established Presence", // "Category Leader" | "Established Presence" | "Emerging / Fragmented" | "Dormant / Stealth"
      "coverageScore": 84,
      "observedNarrative": "Observed narrative tone in research archives",
      "contextualDiagnosis": "Actionable evaluation of how this channel supports their PR"
    },
    {
      "channel": "Executive LinkedIn & Professional Network",
      "maturity": "Established Presence",
      "coverageScore": 76,
      "observedNarrative": "Tone and cadence on professional social channels",
      "contextualDiagnosis": "Actionable evaluation"
    },
    {
      "channel": "Mainstream Business & Tech Press",
      "maturity": "Emerging / Fragmented",
      "coverageScore": 52,
      "observedNarrative": "Third-party press mentions and quotes",
      "contextualDiagnosis": "Actionable evaluation"
    },
    {
      "channel": "Podcast & Audio/Video Broadcast",
      "maturity": "Emerging / Fragmented",
      "coverageScore": 60,
      "observedNarrative": "Interview presence and conversational authority",
      "contextualDiagnosis": "Actionable evaluation"
    },
    {
      "channel": "Proprietary Digital Anchor (Practice Hub / Website)",
      "maturity": "Category Leader",
      "coverageScore": 82,
      "observedNarrative": "Clarity of value proposition on their owned hub",
      "contextualDiagnosis": "Actionable evaluation"
    },
    {
      "channel": "Advisory Boards & Governance Registries",
      "maturity": "Established Presence",
      "coverageScore": 75,
      "observedNarrative": "Formal governance and committee affiliations",
      "contextualDiagnosis": "Actionable evaluation"
    }
  ],
  "deepMirrorReflection": {
    "executiveSummary": "Comprehensive friendly 3-4 sentence assessment of what someone discovers when looking deeply into their background.",
    "verifiedCoreStrengths": ["Strength 1 with evidence", "Strength 2 with evidence", "Strength 3 with evidence"],
    "discoveredPerceptionRisks": ["Blind spot 1 with evidence", "Blind spot 2 with evidence"],
    "theUnindexedAsset": "The most valuable methodology, research, or capability they possess that is currently under-communicated in public PR.",
    "outsideWorldVerdict": "The outside world's verdict: why people trust them and how to remove friction so people appreciate their full value."
  },
  "mirrorComparison": {
    "selfPerceptionSummary": "Who they think they are: summary of their self-image and internal values",
    "publicPerceptionSummary": "What people actually think of them: summary of outside perception",
    "educationReflection": {
      "schoolsAndDegrees": "Alma maters, degrees, universities, academic honors",
      "howYouViewIt": "How they view their schooling and academic credentials",
      "howPeoplePerceiveIt": "How people and outside observers perceive their schooling",
      "quoteOrSignal": "Verifiable quote or perception signal regarding education"
    },
    "workExperienceReflection": {
      "rolesAndMilestones": "Key positions, companies, projects, and career milestones",
      "howYouViewIt": "How they view their work experience and contributions",
      "howPeoplePerceiveIt": "How prospective clients, peers, or recruiters view their career track",
      "quoteOrSignal": "Verifiable quote or perception signal regarding work experience"
    },
    "awardsReflection": {
      "recognitionsAndHonors": "Awards, public honors, and accolades",
      "howYouViewIt": "How they view their awards",
      "howPeoplePerceiveIt": "Whether people know about these awards or if they are hidden",
      "quoteOrSignal": "Verifiable quote or citation regarding honors"
    },
    "challengesAndProblemsReflection": {
      "problemsOrMisconceptions": "Tough problems solved, misconceptions, or obstacles navigated",
      "howYouViewIt": "How they navigated and learned from these challenges",
      "howPeoplePerceiveIt": "How audiences and peers responded to these challenges",
      "quoteOrSignal": "Verifiable quote or community comment about overcoming challenges"
    },
    "gapBreakdown": [
      {
        "aspect": "e.g. Education & Academic Heritage / Career Gravitas / Awards Visibility / Overcoming Skepticism",
        "howYouSeeIt": "Inner self-perception",
        "howTheWorldSeesIt": "Outer public reality",
        "clearExampleOrQuote": "Exact quote, comment, or observation",
        "friendlyGuidance": "Encouraging, constructive advice to align the two views"
      }
    ]
  },
  "discoveredFootprint": [
    {
      "title": "Title of article, profile, or talk",
      "source": "Platform or Publisher",
      "type": "Profile | Article | Media | Paper | Speaking",
      "observation": "What this shows the public about their behavioral presence"
    }
  ],
  "prAndVisibilityGaps": [
    {
      "issue": "Specific blind spot or narrative friction",
      "severity": "High | Medium | Low",
      "impactOnRevenue": "How this gap reduces deal flow or fee premium",
      "actionableRecommendation": "Immediate behavioral or PR remedy"
    }
  ],
  "timeline": [
    {
      "phase": "Phase 1: Narrative & Mirror Realignment",
      "timeframe": "Days 1 – 30",
      "focus": "Fix the immediate 60-second impression and unify fragmented digital touchpoints",
      "actions": ["Action 1", "Action 2", "Action 3"],
      "expectedImpact": "Immediate clarity for incoming referrals and inbound visitors",
      "revenueUpside": "Eliminates perception friction on 100% of pipeline pitches"
    },
    {
      "phase": "Phase 2: Strategic PR & High-Authority Placement",
      "timeframe": "Days 31 – 60",
      "focus": "Place core insights into targeted media, podcasts, and recognized publications",
      "actions": ["Action 1", "Action 2", "Action 3"],
      "expectedImpact": "Third-party validation establishing category authority",
      "revenueUpside": "Inbound deal inquiries without cold outreach"
    },
    {
      "phase": "Phase 3: Authority Monetization & Advisory Premium",
      "timeframe": "Days 61 – 90",
      "focus": "Leverage amplified reputation to introduce premium retainers and waitlists",
      "actions": ["Action 1", "Action 2", "Action 3"],
      "expectedImpact": "Shift from being evaluated against peers to uncontested authority",
      "revenueUpside": "30% to 50% uplift in accepted advisory fee rates"
    }
  ],
  "audienceResponseAnalysis": {
    "overallDiscourseSummary": "Comprehensive 3-4 sentence analysis of how social media audiences, peers, and clients engage with and comment on their work.",
    "longitudinalEvolution": [
      {
        "era": "Early Career / Academic Foundation",
        "years": "e.g. 2015 – 2019",
        "definingNarrative": "How they were perceived in their early public stages",
        "publicReception": "Character of public and peer reaction",
        "sentimentShift": "Formative / Low Visibility", // "Formative / Low Visibility" | "Rising Authority" | "Established Category Anchor" | "Pivoting / Broadening"
        "keyMilestones": ["Early milestone or publication"]
      },
      {
        "era": "Rise to Domain Recognition",
        "years": "e.g. 2020 – 2023",
        "definingNarrative": "Shift towards industry recognition and keynote/advisory positioning",
        "publicReception": "Increased inbound respect, citations, and professional engagement",
        "sentimentShift": "Rising Authority",
        "keyMilestones": ["Platform launch or marquee paper"]
      },
      {
        "era": "Current Era: Strategic Authority & Scale",
        "years": "2024 – Present",
        "definingNarrative": "Contemporary market stance and advisory footprint",
        "publicReception": "High respect with recurring desire for accessible commercial frameworks",
        "sentimentShift": "Established Category Anchor",
        "keyMilestones": ["Current venture, executive counsel, and public voice"]
      }
    ],
    "platformDossiers": [
      {
        "platform": "LinkedIn",
        "handleOrProfile": "Executive Profile / Company Page",
        "audienceType": "C-Suite, Founders, VP Product, Trust & Safety Heads, Academics",
        "dominantTone": "Deep Respect & Endorsement", // "Deep Respect & Endorsement" | "Intellectual Debate" | "Passive Observation" | "Mixed Engagement"
        "recurringCommentThemes": [
          "Validation of empirical rigor over tech hype",
          "Calls for real-world implementation case studies",
          "High alignment with ethical and human-centric mission"
        ],
        "sampleResponses": [
          {
            "archetype": "Enterprise Executive / Studio Head",
            "quoteOrSentiment": "Strong praise for bringing scientific rigor to a domain dominated by guesswork",
            "context": "Responses to thought leadership posts and milestone announcements"
          },
          {
            "archetype": "Industry Peer / Researcher",
            "quoteOrSentiment": "Intellectual respect and citation of methodologies",
            "context": "Professional debate and methodology discussion"
          }
        ],
        "engagementMetrics": {
          "resonanceScore": 84,
          "discourseDepth": "High-Level & Substantive", // "High-Level & Substantive" | "Transactional" | "Conversational" | "Quiet / Under-leveraged"
          "sentimentRatio": "88% Positive / 10% Inquisitive / 2% Critical"
        }
      },
      {
        "platform": "Facebook",
        "handleOrProfile": "Public Footprint / Community Mentions",
        "audienceType": "Broader professional community, event attendees, peers",
        "dominantTone": "Passive Observation",
        "recurringCommentThemes": [
          "Supportive congratulations on awards and speaking appearances",
          "Limited deep technical debate compared to LinkedIn"
        ],
        "sampleResponses": [
          {
            "archetype": "Colleague / Community Follower",
            "quoteOrSentiment": "Warm congratulations and interpersonal validation",
            "context": "Event photos and organizational updates"
          }
        ],
        "engagementMetrics": {
          "resonanceScore": 62,
          "discourseDepth": "Conversational",
          "sentimentRatio": "92% Positive / 8% Neutral"
        }
      },
      {
        "platform": "Industry Forums & YouTube",
        "handleOrProfile": "Conference Talks & Keynote Streams",
        "audienceType": "Engineers, behavioral psychologists, industry practitioners",
        "dominantTone": "Intellectual Debate",
        "recurringCommentThemes": [
          "Appreciation for actionable behavioral dynamics",
          "Questions regarding integration complexity"
        ],
        "sampleResponses": [
          {
            "archetype": "Practitioner / Developer",
            "quoteOrSentiment": "Fascinating talk; would love to see how this scales in live service environments",
            "context": "Comments under conference recordings and panel discussions"
          }
        ],
        "engagementMetrics": {
          "resonanceScore": 76,
          "discourseDepth": "High-Level & Substantive",
          "sentimentRatio": "85% Positive / 12% Inquisitive / 3% Skeptical"
        }
      }
    ],
    "sentimentSynthesis": {
      "whatPeoplePraiseMost": [
        "Uncompromising scientific integrity and evidence-based grounding",
        "Compassionate, human-first perspective on technology and behavior"
      ],
      "whatAudiencesQuestionOrDebate": [
        "How quickly the academic frameworks can be operationalized by resource-constrained teams",
        "Commercial monetization metrics vs. pure compliance"
      ],
      "perceivedRelatabilityVsDistance": "High intellectual gravitas commands immediate respect, but occasional academic phrasing can create slight perceptual distance for hurried commercial operators."
    }
  },
  "selfDescriptionFromSources": {
    "synthesizedSelfAccount": "Unified account of what this person thinks of themselves, synthesized from their own statements across social media, interviews, and authored articles.",
    "primarySelfArchetype": "How they conceptualize their role (e.g. Empirical Reformer / Strategic Catalyst)",
    "coreSelfBeliefs": [
      "Stated principle or mission 1",
      "Stated principle or mission 2"
    ],
    "socialMediaBios": [
      {
        "platform": "LinkedIn", // "LinkedIn" | "Facebook" | "Twitter / X" | "Substack"
        "handleOrUrl": "https://...",
        "headline": "Profile headline",
        "selfDescriptionExcerpt": "Quote or summary from bio",
        "statedMissionAndValues": "Stated purpose",
        "toneAndPosture": "Analytical, mission-driven, etc."
      }
    ],
    "interviewsAndPodcasts": [
      {
        "outletOrHost": "Name of podcast, media show, or conference",
        "titleOrTopic": "Topic or title",
        "yearOrEra": "2024",
        "directSelfQuote": "Direct quote of how they describe their work, philosophy, or motivation",
        "topicContext": "Context of discussion",
        "underlyingSelfView": "What this reveals about their self-conception"
      }
    ],
    "articlesAndAuthoredPieces": [
      {
        "publication": "Publisher / Medium / Substack",
        "title": "Article title",
        "authorBioOrStatement": "Author bio excerpt",
        "statedMission": "Stated goal of their work",
        "primaryPerspective": "Perspective taken"
      }
    ]
  },
  "evaluatedCommentsAndFeedback": {
    "overallCommentsSummary": "Comprehensive evaluation of comments under posts, articles, and interviews.",
    "netPublicSentimentScore": 88, // 0-100
    "sentimentBreakdown": {
      "admirationAndPraise": 78,
      "curiosityAndInquiry": 16,
      "constructiveSkepticism": 6
    },
    "commentThreads": [
      {
        "sourceTitle": "Title of post, article, or interview recording",
        "sourceType": "Social Media Post", // "Social Media Post" | "Article & Op-Ed" | "Interview & Podcast" | "Conference & Keynote"
        "platform": "LinkedIn", // "LinkedIn" | "Facebook" | "YouTube" | "Industry Press" | "Forum & Community"
        "totalAnalyzedComments": 35,
        "dominantSentiment": "Overwhelmingly Endorsing",
        "sentimentRatio": "88% Endorsement / 9% Inquisitive / 3% Skeptical",
        "keyCommentThemes": ["Theme 1", "Theme 2"],
        "contrastWithSelfDescription": "How the comments compare with what the person stated in this post/interview",
        "sampleComments": [
          {
            "commenterRole": "Role of commenter (e.g. Senior Director, Academic Peer, Client, Skeptic)",
            "commentText": "Specific comment or reaction quote",
            "sentiment": "positive", // "positive" | "constructive" | "skeptical"
            "reflectionInsight": "What this reveals about public perception versus self-description"
          }
        ]
      }
    ],
    "contrastHighlights": [
      {
        "selfClaim": "What the person claimed about themselves or their mission in an interview or post",
        "sourceContext": "Source context",
        "commentersConsensus": "What comments under the piece actually say",
        "mirrorTakeaway": "Constructive takeaway to align perception"
      }
    ]
  }
}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = response.text || '';
      
      // Extract grounding sources if available
      const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const webSources = searchChunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => ({
          title: c.web.title || 'Web Reference',
          url: c.web.uri,
        }));

      // Clean markdown code fence and isolate JSON object
      let cleanedJson = responseText.trim();
      const firstBrace = cleanedJson.indexOf('{');
      const lastBrace = cleanedJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedJson = cleanedJson.substring(firstBrace, lastBrace + 1);
      } else {
        if (cleanedJson.startsWith('```json')) {
          cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        } else if (cleanedJson.startsWith('```')) {
          cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/```$/, '').trim();
        }
      }

      try {
        const parsed = JSON.parse(cleanedJson);
        parsed.webSources = webSources;

        // If parsed disclosedSources is empty or missing, populate from webSources and discoveredFootprint
        if (!parsed.disclosedSources || parsed.disclosedSources.length === 0) {
          parsed.disclosedSources = webSources.map((ws: any, idx: number) => {
            let publisher = 'Web Platform';
            try {
              if (ws.url) {
                publisher = new URL(ws.url).hostname.replace(/^www\./, '');
              }
            } catch {
              publisher = 'Grounded Index';
            }
            return {
              id: `src-grounded-${idx + 1}`,
              title: ws.title || 'Discovered Web Resource',
              url: ws.url || 'https://www.google.com',
              publisher,
              category: 'Media & Press',
              dateOrEra: 'Recent Discovery',
              discoveredEvidence: `Grounded public index touchpoint retrieved during automated web search.`,
              contextualSignificance: `Discovered in real-time web index during deep footprint crawl.`,
              authorityImpact: 'High Credibility',
            };
          });
        }

        return res.json({ success: true, data: parsed, source: 'gemini-grounded' });
      } catch (e) {
        console.warn('Failed to parse Gemini JSON output, falling back to structured synthesis:', e);
      }
    } catch (apiError) {
      console.error('Gemini API call error:', apiError);
    }
  }

  return res.status(502).json({ error: 'Live analysis failed. Please try again.' });
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
    console.log(`FELIXA Experts MVP Server running on port ${PORT}`);
  });
}

startServer();
