import React from 'react';
import { Info } from 'lucide-react';
import { ReportCoverage } from '../types';

// Plain-language note about how far the research went and how sure we can be
export const Disclaimer: React.FC<{ variant?: 'short' | 'full'; coverage?: ReportCoverage }> = ({ variant = 'full', coverage }) => {
  if (variant === 'short') {
    return (
      <p className="text-xs text-stone-500 leading-relaxed">
        ExpertScan only uses public pages it can find online. It can miss things, and an AI writes the report, so it can make mistakes.
        Please check the results before you rely on them.
      </p>
    );
  }
  return (
    <div className="no-print rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-sm text-stone-800 mb-6" role="note">
      <div className="flex items-center gap-2 font-semibold text-amber-900 mb-2">
        <Info className="w-4 h-4" />
        <span>Please read: how far to trust this report</span>
      </div>
      <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
        <li><strong>It is not complete.</strong> We only look at public pages that search engines and open sources show us today. Some sites (LinkedIn, Facebook, Instagram, TikTok, Discord) do not let us read them, so we may miss posts, comments and profiles.</li>
        <li><strong>It can be wrong.</strong> An AI writes this report from what it found. It may misread a page or mix up two people with the same name. Please check each source yourself.</li>
        <li><strong>The scores and labels are opinions,</strong> not facts and not measurements. They are a starting point for thinking, not a judgment about a person.</li>
        <li><strong>Do not use it for big decisions</strong> such as hiring, legal, medical or financial choices.</li>
      </ul>
      {coverage && (
        <div className="mt-3 pt-3 border-t border-amber-200 text-xs sm:text-sm leading-relaxed">
          <p className="font-semibold text-amber-900 mb-1">What this report is based on</p>
          <p>
            {coverage.sourcesUsed} web pages and records
            {coverage.pagesRead > 0 ? `, and we read the full text of ${coverage.pagesRead} of them` : ''}.
            {coverage.searchLimited && ' Our web searches were partly blocked this time, so the picture is thinner than usual.'}
          </p>
          {coverage.platformsFound.length > 0 && <p>Profiles found on: {coverage.platformsFound.join(', ')}.</p>}
          {coverage.platformsNotFound.length > 0 && <p>No profile found on: {coverage.platformsNotFound.join(', ')}. That does not mean none exists.</p>}
        </div>
      )}
    </div>
  );
};
