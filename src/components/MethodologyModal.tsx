import React from 'react';
import { X, ShieldCheck, BookOpen, Search, Eye, Scale } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-xl text-stone-900">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-stone-900" />
            <h2 className="text-lg font-serif-luxury font-semibold text-stone-950">
              FELIXA Behavioral Intelligence Methodology
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono-code text-stone-900 mb-1 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              1. The Perceptual Mirror ("The Way Others See You")
            </h3>
            <p>
              Subject matter experts frequently suffer from the <em>"Curse of Knowledge"</em> and the <em>"Expert's Dilemma"</em>: they evaluate themselves based on internal depth and intent, whereas prospective enterprise clients, journalists, and event organizers form decisive impressions in the first 60 seconds of examining their digital presence. FELIXA analyzes this exact delta.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono-code text-stone-900 mb-1 flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              2. Fiske Stereotype Content Model (Warmth vs. Competence)
            </h3>
            <p>
              Grounded in empirical social psychology (Susan Fiske et al., Princeton University), human social perception operates on two fundamental axes:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
              <li><strong>Competence:</strong> Can this individual solve high-stakes challenges? (Signaled by published frameworks, rigor, and institutional associations).</li>
              <li><strong>Warmth & Approachability:</strong> Does this individual have my best interests at heart? Is it pleasant and safe to work with them?</li>
            </ul>
            <p className="mt-2 text-xs">
              Advisors who score excessively high on competence but low on warmth are perceived as distant technicians rather than trusted advisors, directly capping their pricing power.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono-code text-stone-900 mb-1 flex items-center gap-1.5">
              <Search className="w-4 h-4" />
              3. Web Grounding & Digital Authority Signals
            </h3>
            <p>
              Our automated engine analyzes public web presence via Google Search grounding. It measures third-party citations, earned media, podcast appearances, and unified thesis communication.
            </p>
          </div>

          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <h4 className="font-semibold text-stone-900 mb-1">Build Principle: Absolute Trust</h4>
            <p className="text-stone-600">
              No invented facts, hallucinated quotes, fake scores, or fabricated methodology. When a detail is unavailable or stealth in the public domain, the system explicitly reports it as unindexed capacity.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-stone-50 text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Close Framework
          </button>
        </div>
      </div>
    </div>
  );
};
