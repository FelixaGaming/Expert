import React from 'react';
import { ShieldCheck, HelpCircle } from 'lucide-react';

interface HeaderProps {
  onShowPrinciples: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onShowPrinciples }) => {
  return (
    <header className="w-full border-b border-stone-200/80 bg-white/90 backdrop-blur-xs sticky top-0 z-30 no-print">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-stone-50 flex items-center justify-center font-cinzel font-bold text-sm tracking-widest shadow-xs">
            F
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-cinzel font-bold text-base tracking-widest text-stone-950">
                FELIXA
              </span>
              <span className="text-[10px] font-mono-code font-semibold uppercase px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-300/70">
                EXPERTS MVP
              </span>
            </div>
            <div className="text-[11px] text-stone-500 font-sans -mt-0.5 hidden sm:block">
              Current-state analytics for Experts • Advisors • Consultants
            </div>
          </div>
        </div>

        {/* Right Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onShowPrinciples}
            className="inline-flex items-center gap-1 text-xs font-mono-code text-stone-600 hover:text-stone-900 px-2.5 py-1.5 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
            title="View AI Build Specification & Principles"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-stone-700" />
            <span className="hidden sm:inline">Build Principles</span>
          </button>
          <span className="text-[11px] font-mono-code px-2 py-1 bg-stone-50 border border-stone-200 rounded text-stone-600">
            v2.0
          </span>
        </div>
      </div>
    </header>
  );
};
