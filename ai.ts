// Provider-agnostic model calls (OpenAI, Anthropic, Gemini), using the server's key or an optional visitor key.

import * as cheerio from 'cheerio';
import { spawn } from 'node:child_process';
import { gatherResearch, type ResearchInput } from './research';
import os from 'node:os';

// 'free' needs no key: DuckDuckGo for live search and a free no-signup model (Pollinations).
export type Provider = 'gemini' | 'openai' | 'anthropic' | 'free' | 'claude-cli';

export interface AiConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

export interface AiResult {
  text: string;
  sources: { title: string; url: string }[];
  socials?: { platform: string; url: string; evidence: string }[];
  coverage?: import('./research').ResearchCoverage;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-3.8-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  free: 'openai-fast',
  'claude-cli': 'haiku',
};

export class AiError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

const isProvider = (v: unknown): v is Provider => v === 'gemini' || v === 'openai' || v === 'anthropic' || v === 'free' || v === 'claude-cli';

const ENV_KEYS: Record<'gemini' | 'openai' | 'anthropic', string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

// Providers the server owner has configured with a key
export function serverProviders(): Provider[] {
  const keyed = (Object.keys(ENV_KEYS) as (keyof typeof ENV_KEYS)[]).filter((p) => (process.env[ENV_KEYS[p]] || '').trim());
  // 'claude-cli' uses the local Claude Code login: development only, enabled by AI_PROVIDER=claude-cli
  const local: Provider[] = process.env.AI_PROVIDER === 'claude-cli' ? ['claude-cli'] : [];
  return [...local, ...keyed, 'free'];
}

// Visitors need no key: the server's own key is used, or the keyless 'free' mode when none is set. A visitor may optionally send their own
// (x-ai-provider / x-ai-key / x-ai-model headers), which takes priority.
export function readAiConfig(headers: Record<string, string | string[] | undefined>): AiConfig {
  const one = (k: string) => {
    const v = headers[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || '';
  };
  const provider = one('x-ai-provider');
  const apiKey = one('x-ai-key');
  const modelHeader = one('x-ai-model');
  const pickModel = (p: Provider, m: string) => (/^[\w.:\-/]{1,80}$/.test(m) ? m : DEFAULT_MODELS[p]);

  if (isProvider(provider) && provider !== 'free' && provider !== 'claude-cli' && apiKey) {
    if (apiKey.length > 300 || /\s/.test(apiKey)) {
      throw new AiError('That API key does not look valid.', 401, 'BAD_API_KEY');
    }
    return { provider, apiKey, model: pickModel(provider, modelHeader) };
  }

  const available = serverProviders();
  const wanted = (process.env.AI_PROVIDER || '').trim();
  const chosen = isProvider(provider) && available.includes(provider) ? provider
    : isProvider(wanted) && available.includes(wanted) ? wanted
    : available[0];
  if (chosen === 'claude-cli') return { provider: 'claude-cli', apiKey: '', model: pickModel('claude-cli', (process.env.CLAUDE_CLI_MODEL || '').trim()) };
  if (chosen === 'free') return { provider: 'free', apiKey: '', model: DEFAULT_MODELS.free };
  const model = (process.env[`${chosen.toUpperCase()}_MODEL`] || '').trim() || modelHeader;
  return { provider: chosen, apiKey: process.env[ENV_KEYS[chosen]]!.trim(), model: pickModel(chosen, model) };
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await res.text();
  let json: any = {};
  try { json = JSON.parse(raw); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const detail = json?.error?.message || json?.error || raw.slice(0, 200) || res.statusText;
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(String(detail)))) {
      throw new AiError('The provider rejected your API key. Check it in Settings.', 401, 'BAD_API_KEY');
    }
    if (res.status === 429) {
      throw new AiError('The provider rate-limited or quota-limited your key. Wait a moment or try another provider.', 429, 'PROVIDER_LIMIT');
    }
    throw new AiError(`Provider error (${res.status}): ${String(detail).slice(0, 200)}`, 502, 'PROVIDER_ERROR');
  }
  return json;
}

const dedupe = (items: { title: string; url: string }[]) => {
  const seen = new Set<string>();
  return items.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url));
};

async function gemini(cfg: AiConfig, prompt: string, search: boolean): Promise<AiResult> {
  const json = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    { 'x-goog-api-key': cfg.apiKey },
    { contents: [{ parts: [{ text: prompt }] }], ...(search ? { tools: [{ google_search: {} }] } : {}) },
  );
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p: any) => p.text || '').join('');
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .filter((c: any) => c.web?.uri)
    .map((c: any) => ({ title: c.web.title || 'Web Reference', url: c.web.uri }));
  return { text, sources: dedupe(sources) };
}

async function openai(cfg: AiConfig, prompt: string, search: boolean): Promise<AiResult> {
  const json = await post(
    'https://api.openai.com/v1/responses',
    { authorization: `Bearer ${cfg.apiKey}` },
    { model: cfg.model, input: prompt, ...(search ? { tools: [{ type: 'web_search' }] } : {}) },
  );
  let text = '';
  const sources: { title: string; url: string }[] = [];
  for (const item of json.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type !== 'output_text') continue;
      text += c.text || '';
      for (const a of c.annotations || []) {
        if (a.type === 'url_citation' && a.url) sources.push({ title: a.title || 'Web Reference', url: a.url });
      }
    }
  }
  return { text, sources: dedupe(sources) };
}

async function anthropic(cfg: AiConfig, prompt: string, search: boolean): Promise<AiResult> {
  const json = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    {
      model: cfg.model,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
      ...(search ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }] } : {}),
    },
  );
  let text = '';
  const sources: { title: string; url: string }[] = [];
  for (const block of json.content || []) {
    if (block.type === 'text') {
      text += block.text || '';
      for (const c of block.citations || []) {
        if (c.url) sources.push({ title: c.title || 'Web Reference', url: c.url });
      }
    } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) sources.push({ title: r.title || 'Web Reference', url: r.url });
    }
  }
  return { text, sources: dedupe(sources) };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function bingSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`, {
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());
    const out: { title: string; url: string; snippet: string }[] = [];
    $('li.b_algo').each((_, el) => {
      const a = $(el).find('h2 a').first();
      let href = a.attr('href') || '';
      // Bing wraps results in a redirect whose `u` parameter is the real URL in base64 (prefixed "a1")
      const m = href.match(/[?&]u=a1([^&]+)/);
      if (m) {
        try { href = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { return; }
      }
      if (!/^https?:\/\//i.test(href)) return;
      out.push({ title: a.text().trim(), url: href, snippet: $(el).find('p').first().text().trim() });
    });
    return out;
  } catch {
    return [];
  }
}

// Bing first, DuckDuckGo as a fallback: either may rate-limit a busy server
async function webSearch(query: string) {
  const bing = await bingSearch(query);
  return bing.length ? bing : duckSearch(query);
}

async function duckSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: new URLSearchParams({ q: query }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());
    const out: { title: string; url: string; snippet: string }[] = [];
    $('.result').each((_, el) => {
      const a = $(el).find('a.result__a').first();
      let href = a.attr('href') || '';
      const m = href.match(/[?&]uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
      if (!/^https?:\/\//i.test(href)) return;
      out.push({ title: a.text().trim(), url: href, snippet: $(el).find('.result__snippet').text().trim() });
    });
    return out;
  } catch {
    return [];
  }
}

// Runs the local `claude` CLI (your Claude login, no API key) Development only.
// Claude gets NO tools: the server searches and hands it the results as text.
async function claudeCli(cfg: AiConfig, rawPrompt: string, search: boolean, query?: string, research?: ResearchInput, signal?: AbortSignal): Promise<AiResult> {
  // Deep mode (CLAUDE_CLI_TOOLS=web): only the final report may search and open pages itself, with the best model and high effort.
  // Quick steps, such as listing profiles, use a fast model without tools.
  const agentic = process.env.CLAUDE_CLI_TOOLS === 'web' && research?.depth === 'deep';
  const model = agentic ? cfg.model : (process.env.CLAUDE_CLI_FAST_MODEL || 'haiku').trim();
  const { full: prompt, sources, socials, coverage } = await withSearchContext(rawPrompt, search, query, research, 120_000, agentic);
  return new Promise((resolve, reject) => {
    const args = agentic
      ? ['-p', '--output-format', 'json', '--model', model, '--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch', 'WebFetch', '--effort', 'high', '--no-session-persistence', '--permission-mode', 'dontAsk']
      : ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--no-session-persistence', '--permission-mode', 'dontAsk'];
    const child = spawn('claude', args, { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new AiError('Claude took too long. Try again.', 504, 'CLI_TIMEOUT')); }, (agentic ? 2_400_000 : 900_000));
    // Stop the Claude process when the page is closed or the connection drops, so it does not keep using the plan
    const stop = () => { clearTimeout(timer); child.kill(); reject(new AiError('Cancelled.', 499, 'CANCELLED')); };
    if (signal?.aborted) stop(); else signal?.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', () => { clearTimeout(timer); reject(new AiError('The `claude` command was not found on this computer.', 503, 'CLI_MISSING')); });
    child.on('close', () => {
      clearTimeout(timer);
      let json: any = {};
      try { json = JSON.parse(out); } catch { /* not JSON */ }
      const text = typeof json.result === 'string' ? json.result : '';
      if (json.is_error || !text) {
        const msg = text || err || out;
        if (/not logged in|login/i.test(msg)) return reject(new AiError('Claude is not signed in on this computer. Run `claude` in a terminal and log in.', 401, 'CLI_LOGIN'));
        return reject(new AiError(`Claude CLI error: ${String(msg).slice(0, 160)}`, 502, 'CLI_ERROR'));
      }
      resolve({ text, sources, socials, coverage });
    });
    child.stdin.end(prompt);
  });
}

// Runs DuckDuckGo searches on the server and prepends the results, so a model with no web tools can still use live data.
const AGENTIC_INTRO = 'You can use the tools WebSearch and WebFetch. The research material below was gathered first: treat it as a starting point and go much deeper with your tools. Search for and open pages about: awards and recognitions, talks, presentations, keynotes, conferences, publications, books, interviews, podcasts, videos, news, advisory and board roles, committees, projects, testimonials, and social profiles. Open the person\'s own sites and their other pages. Check for other people with the same name and keep them apart. WebFetch cannot read LinkedIn or Facebook, so never claim to have read them. Cite only URLs that appear in the material or that you actually opened. Keep going until each area is covered. When you are done, answer in the exact output format the task requires, with nothing before or after it, and never ask questions.';

async function withSearchContext(prompt: string, search: boolean, query?: string, research?: ResearchInput, maxChars = 120_000, agentic = false) {
  const intro = agentic ? AGENTIC_INTRO : 'You have no browsing tools. The web research has already been done for you: the material below was gathered live and is your only source of facts. Where the task says to search the web, use this material instead. Cite only URLs that appear in it. If the material does not support a claim, say it is not found rather than inventing it. The material may include namesakes (other people with the same name): use affiliation, field and location to separate them, and flag doubtful matches. Do not refuse or ask questions: always answer in the exact output format the task requires, with nothing before or after it.';
  if (search && research) {
    const pack = await gatherResearch(research, maxChars);
    console.log('research:', research.name, JSON.stringify(pack.stats));
    if (!pack.sources.length) throw new AiError('Web search is temporarily unavailable. Please try again in a few minutes.', 503, 'SEARCH_UNAVAILABLE');
    return { full: `${intro}\n\nLIVE RESEARCH MATERIAL:\n\n${pack.context}\n\n---\nTASK:\n${prompt}`, sources: pack.sources, socials: pack.socials, coverage: pack.coverage };
  }
  let sources: { title: string; url: string }[] = [];
  let full = prompt;
  if (search && query) {
    const queries = [query, `${query} interview OR keynote OR award OR university OR podcast`];
    const hits = (await Promise.all(queries.map(webSearch))).flat();
    const seen = new Set<string>();
    const unique = hits.filter((h) => !seen.has(h.url) && seen.add(h.url)).slice(0, 12);
    if (!unique.length) throw new AiError('Web search is temporarily unavailable. Please try again in a few minutes.', 503, 'SEARCH_UNAVAILABLE');
    sources = unique.map((h) => ({ title: h.title || h.url, url: h.url }));
    const context = unique.map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.snippet}`).join('\n\n').slice(0, Math.min(maxChars, 9000));
    full = `${intro}\n\nLIVE WEB SEARCH RESULTS:\n\n${context}\n\n---\nTASK:\n${prompt}`;
  }
  return { full, sources, socials: undefined as AiResult['socials'], coverage: undefined as AiResult['coverage'] };
}

const MODEL_FALLBACKS = ['openai-fast', 'openai'];

async function free(cfg: AiConfig, prompt: string, search: boolean, query?: string, research?: ResearchInput): Promise<AiResult> {
  const { full, sources, socials, coverage } = await withSearchContext(prompt, search, query, research, 9000);
  let lastErr = '';
  for (const model of [cfg.model, ...MODEL_FALLBACKS.filter((m) => m !== cfg.model)]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: full }] }),
          signal: AbortSignal.timeout(120_000),
        });
        const json: any = await res.json().catch(() => ({}));
        const text = json?.choices?.[0]?.message?.content;
        if (res.ok && typeof text === 'string' && text.trim()) return { text, sources: dedupe(sources), socials, coverage };
        lastErr = json?.error?.message || json?.error || `status ${res.status}`;
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
  }
  throw new AiError(`The free AI service is busy right now (${String(lastErr).slice(0, 80)}). Please try again in a minute.`, 503, 'FREE_BUSY');
}

// Runs one prompt on the visitor's chosen provider, with live web search when `search` is true.
export async function runModel(cfg: AiConfig, prompt: string, search = true, query?: string, research?: ResearchInput, signal?: AbortSignal): Promise<AiResult> {
  const out =
    cfg.provider === 'claude-cli' ? await claudeCli(cfg, prompt, search, query, research, signal)
    : cfg.provider === 'free' ? await free(cfg, prompt, search, query, research)
    : cfg.provider === 'gemini' ? await gemini(cfg, prompt, search)
    : cfg.provider === 'openai' ? await openai(cfg, prompt, search)
    : await anthropic(cfg, prompt, search);
  if (!out.text.trim()) throw new AiError('The model returned an empty response. Try again.', 502, 'EMPTY_RESPONSE');
  return out;
}
