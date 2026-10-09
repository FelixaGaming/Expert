import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps: [string, string][] = [
    ['We search the public web.', 'We use several search engines, news, encyclopedia and research records (OpenAlex, ORCID, Crossref, Semantic Scholar), and we read the pages we can open. Pages you tick in the review step are read first. Pages you untick are never used.'],
    ['Every source gets a number.', 'The AI may only use numbered sources. It is not allowed to invent sources, quotes, comments or people.'],
    ['The server checks the AI.', 'Quotes and comments must be found word for word in the source, or they are removed or shown as "Not proven". A claim that only the person\'s own page supports is marked "Self-reported", not "Verified".'],
    ['Every finding has a label.', 'Verified, self-reported, observed, inference, hypothesis or not proven. Click "Evidence" on any finding to see the source, the date we accessed it and the exact words.'],
    ['Three views are kept apart.', 'How the person sees themself (only from their own answers), how they present themself (their own channels), and what independent sources show.'],
    ['Scores come from checklists.', 'Each of the five scores uses a fixed checklist with fixed weights. It is shown only when at least half the checklist could be judged. Otherwise it says "Not enough evidence to score".'],
    ['Not found is not the same as not real.', 'If we cannot find an award, degree or comment, we say "no public evidence found". We never say it does not exist.'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="How ExpertScan works">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-xl text-stone-900">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-stone-900" />
            <h2 className="text-lg font-semibold text-stone-950">How ExpertScan works</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ol className="space-y-4 text-sm text-stone-700 leading-relaxed list-decimal pl-5">
          {steps.map(([title, text]) => (
            <li key={title}><strong className="text-stone-900">{title}</strong> {text}</li>
          ))}
        </ol>

        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950">
          <strong>Limits.</strong> ExpertScan only sees public pages. Some sites (LinkedIn, Facebook, Instagram, TikTok, Discord) block automatic reading, so their content is mostly missing. An AI writes the wording and can still make mistakes, so please check the sources.
        </div>

        <div className="mt-6 pt-4 border-t border-stone-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-stone-900 text-stone-50 text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
