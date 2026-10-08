import React, { useState } from 'react';
import { X, KeyRound, ExternalLink } from 'lucide-react';
import { AiSettings, PROVIDERS, Provider, getSettings, setSettings } from '../ai-settings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (s: AiSettings | null) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const existing = getSettings();
  const [provider, setProvider] = useState<Provider>(existing?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(existing?.apiKey || '');
  const [model, setModel] = useState(existing?.model || '');

  if (!isOpen) return null;
  const info = PROVIDERS[provider];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { provider, apiKey: apiKey.trim(), model: model.trim() };
    if (!next.apiKey) return;
    setSettings(next);
    onSaved(next);
    onClose();
  };

  const clear = () => {
    setSettings(null);
    setApiKey('');
    onSaved(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="AI settings">
      <form onSubmit={save} className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Connect your AI
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              ExpertScan is free. It runs on your own key, so you control the cost. Your key stays in this browser and is
              passed straight to the provider. It is never saved on our server.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-stone-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <fieldset className="grid grid-cols-3 gap-2">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <label
              key={p}
              className={`text-center text-xs font-medium rounded-lg border px-2 py-2 cursor-pointer ${
                provider === p ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <input type="radio" name="provider" className="sr-only" checked={provider === p} onChange={() => setProvider(p)} />
              {PROVIDERS[p].label}
            </label>
          ))}
        </fieldset>

        <p className="text-xs text-stone-500">{info.free}</p>

        <div>
          <label htmlFor="ai-key" className="block text-xs font-semibold text-stone-700 mb-1">API key</label>
          <input
            id="ai-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={info.keyHint}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 mt-1">
            Get a {info.label} key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div>
          <label htmlFor="ai-model" className="block text-xs font-semibold text-stone-700 mb-1">Model (optional)</label>
          <input
            id="ai-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={info.model}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={clear} className="text-xs text-stone-500 hover:text-red-700 cursor-pointer">
            Remove saved key
          </button>
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};
