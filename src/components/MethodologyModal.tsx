import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps: [string, string][] = [
    ['We search the public web.', 'We use several search engines, news, encyclopedia and research records (OpenAlex, ORCID, Crossref, Semantic Scholar), and we read the pages we can open.'],
    ['You check the pages first.', 'Other people may share your name. In the review step you tick the pages that are really yours and untick the rest. Pages you untick are not used.'],
    ['An AI writes the report.', 'It writes from the pages we found. We tell it not to make things up and to say "not found" when it cannot find something. We cannot promise it never makes a mistake.'],
    ['The scores and labels are opinions.', 'The AI chooses them from what it read. They are a starting point for thinking, not measurements and not a judgment about a person.'],
    ['Not found is not the same as not real.', 'If we cannot find an award, a degree or a comment, it may still exist. Some of it is simply not public, or we could not read it.'],
    ['Some sites block us.', 'LinkedIn, Facebook, Instagram, TikTok and Discord do not let us read them automatically, so their posts and comments are mostly missing.'],
    ['Please check the sources.', 'The list of web pages used is at the end of the report. Open them and check anything important yourself.'],
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
