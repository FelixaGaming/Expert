import React, { useState } from 'react';
import { ExternalLink, UserCheck, AlertTriangle } from 'lucide-react';
import { DiscoveredWebsite } from '../types';

export const IDENTITY_PLATFORMS = ['LinkedIn', 'Facebook'] as const;
export type IdentityPlatform = (typeof IDENTITY_PLATFORMS)[number];

export const isPlatform = (w: DiscoveredWebsite, p: IdentityPlatform) =>
  w.platform.toLowerCase().includes(p.toLowerCase()) || w.domain.includes(p.toLowerCase());
export const isSearchLink = (w: DiscoveredWebsite) => w.id.includes('-search-');

interface Props {
  expertName: string;
  websites: DiscoveredWebsite[];
  selectedMap: Record<string, boolean>;
  setSelectedMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onAddLink: (platform: IdentityPlatform, url: string) => void;
  pasted: Record<string, string>;
  setPasted: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const searchUrl = (p: IdentityPlatform, name: string) =>
  p === 'LinkedIn'
    ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`
    : `https://www.facebook.com/search/people/?q=${encodeURIComponent(name)}`;

// For LinkedIn and Facebook the user always chooses which profile is theirs, or adds their own link or text
export const SocialIdentityPicker: React.FC<Props> = ({ expertName, websites, selectedMap, setSelectedMap, onAddLink, pasted, setPasted }) => {
  const [links, setLinks] = useState<Record<string, string>>({});

  return (
    <div className="grid md:grid-cols-2 gap-4 mb-1">
      {IDENTITY_PLATFORMS.map((platform) => {
        const candidates = websites.filter((w) => isPlatform(w, platform) && !isSearchLink(w));
        const chosen = candidates.find((w) => selectedMap[w.id]);
        const choose = (id: string | null) =>
          setSelectedMap((prev) => {
            const next = { ...prev };
            candidates.forEach((c) => { next[c.id] = c.id === id; });
            return next;
          });
        return (
          <div key={platform} className="rounded-xl border border-stone-300 bg-white p-4 text-sm">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4" /> {platform}: which one is you?
            </h3>
            {candidates.length > 1 && (
              <div className="flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>We found {candidates.length} profiles that may match this name. Please choose yours.</span>
              </div>
            )}
            {candidates.length === 0 && (
              <p className="text-xs text-stone-600 mb-2">We did not find a {platform} profile automatically. {platform} blocks automatic reading, so please add your link or search for yourself.</p>
            )}

            <div className="space-y-2">
              {candidates.map((c) => (
                <label key={c.id} className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer ${selectedMap[c.id] ? 'border-emerald-400 bg-emerald-50/60' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <input type="radio" name={`pick-${platform}`} checked={!!selectedMap[c.id]} onChange={() => choose(c.id)} className="mt-1" />
                  <span className="min-w-0 text-xs">
                    <span className="font-medium text-stone-900 block">{c.title}</span>
                    <span className="text-stone-600 block line-clamp-2">{c.snippet}</span>
                    <a href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-stone-500 underline inline-flex items-center gap-1 break-all">
                      {c.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </span>
                </label>
              ))}
              <label className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer text-xs ${candidates.length > 0 && !chosen ? 'border-stone-400 bg-stone-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                <input type="radio" name={`pick-${platform}`} checked={candidates.length > 0 && !chosen} onChange={() => choose(null)} />
                <span>None of these is me / I am not on {platform}</span>
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={links[platform] || ''}
                onChange={(e) => setLinks((p) => ({ ...p, [platform]: e.target.value }))}
                placeholder={`Paste my ${platform} link`}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
              <button
                type="button"
                disabled={!(links[platform] || '').trim()}
                onClick={() => { onAddLink(platform, links[platform].trim()); setLinks((p) => ({ ...p, [platform]: '' })); }}
                className="px-3 py-1.5 text-xs bg-stone-900 text-white rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Add
              </button>
            </div>
            <a href={searchUrl(platform, expertName)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-stone-600 underline">
              Search {platform} for this name <ExternalLink className="w-3 h-3" />
            </a>

            <div className="mt-3">
              <label htmlFor={`paste-${platform}`} className="block text-[11px] font-semibold text-stone-700 mb-1">
                Optional, recommended: paste text from your {platform} profile
              </label>
              <textarea
                id={`paste-${platform}`}
                rows={4}
                maxLength={20000}
                value={pasted[platform] || ''}
                onChange={(e) => setPasted((p) => ({ ...p, [platform]: e.target.value }))}
                placeholder={platform === 'LinkedIn' ? 'About, Experience, Honors & awards, Publications, Featured, recent posts...' : 'About, Work and education, Awards, Posts and comments...'}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white"
              />
              <p className="text-[11px] text-stone-500 mt-1">{platform} does not let us read it, so your pasted text is the only way the report can use what is there. It is treated as written by you.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
