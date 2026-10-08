// Provider-agnostic model calls (OpenAI, Anthropic, Gemini), using the server's key or an optional visitor key.

export type Provider = 'gemini' | 'openai' | 'anthropic';

export interface AiConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

export interface AiResult {
  text: string;
  sources: { title: string; url: string }[];
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
};

export class AiError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

const isProvider = (v: unknown): v is Provider => v === 'gemini' || v === 'openai' || v === 'anthropic';

const ENV_KEYS: Record<Provider, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

// Providers the server owner has configured with a key
export function serverProviders(): Provider[] {
  return (Object.keys(ENV_KEYS) as Provider[]).filter((p) => (process.env[ENV_KEYS[p]] || '').trim());
}

// Visitors need no key: the server's own key is used. A visitor may optionally send their own
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

  if (isProvider(provider) && apiKey) {
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
  if (!chosen) {
    throw new AiError('ExpertScan is not configured yet: the site owner needs to set an AI key on the server.', 503, 'NOT_CONFIGURED');
  }
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

// Runs one prompt on the visitor's chosen provider, with live web search when `search` is true.
export async function runModel(cfg: AiConfig, prompt: string, search = true): Promise<AiResult> {
  const out =
    cfg.provider === 'gemini' ? await gemini(cfg, prompt, search)
    : cfg.provider === 'openai' ? await openai(cfg, prompt, search)
    : await anthropic(cfg, prompt, search);
  if (!out.text.trim()) throw new AiError('The model returned an empty response. Try again.', 502, 'EMPTY_RESPONSE');
  return out;
}
