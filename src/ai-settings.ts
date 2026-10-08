export type Provider = 'gemini' | 'openai' | 'anthropic';

export interface AiSettings {
  provider: Provider;
  apiKey: string;
  model: string;
}

export const PROVIDERS: Record<Provider, { label: string; keyUrl: string; keyHint: string; model: string; free: string }> = {
  gemini: {
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    model: 'gemini-3.8-flash',
    free: 'Has a free tier: create a key in Google AI Studio at no cost.',
  },
  openai: {
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    model: 'gpt-4o-mini',
    free: 'Uses your own OpenAI account. Web search may need billing enabled.',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    model: 'claude-haiku-4-5',
    free: 'Uses your own Anthropic account. Web search must be enabled for your organization.',
  },
};

const STORAGE_KEY = 'expertscan.ai';

// The key lives only in this browser and is sent per request to our server, which forwards it to the provider and never stores it.
export function loadSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.provider in PROVIDERS && typeof s.apiKey === 'string' && s.apiKey ? s : null;
  } catch {
    return null;
  }
}

export function saveSettings(s: AiSettings | null): void {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked: settings last for this page view only */
  }
}

let current: AiSettings | null = loadSettings();
export const getSettings = () => current;
export function setSettings(s: AiSettings | null) {
  current = s;
  saveSettings(s);
}

// Headers that carry the visitor's provider choice and key to the server
export function aiHeaders(): Record<string, string> {
  if (!current) return {};
  const h: Record<string, string> = { 'x-ai-provider': current.provider, 'x-ai-key': current.apiKey };
  if (current.model) h['x-ai-model'] = current.model;
  return h;
}
