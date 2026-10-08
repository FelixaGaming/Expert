import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Globe, Search, ShieldCheck, Sparkles, Brain, CheckCircle2 } from 'lucide-react';

interface ResearchingScreenProps {
  expertName: string;
}

const STEPS = [
  'Initializing FELIXA Public Perception Mirror...',
  'Reflecting longitudinal presence & evolution throughout the years...',
  'Gathering audience reactions & comments on LinkedIn, FB, and community discussions...',
  'Evaluating schools, degrees, work milestones, awards & challenges...',
  'Connecting verified websites & ruling out unrelated namesakes...',
  'Polishing the mirror: Comparing how people see you vs. how you perceive yourself...',
];

export const ResearchingScreen: React.FC<ResearchingScreenProps> = ({ expertName }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="researching-container" className="w-full max-w-xl mx-auto px-4 py-16 text-center">
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-stone-200 animate-ping opacity-25"></div>
        <div className="w-20 h-20 rounded-2xl bg-stone-900 text-stone-50 flex items-center justify-center shadow-lg relative">
          <Globe className="w-9 h-9 animate-pulse" />
        </div>
      </div>

      <div className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-2">
        Automated Behavioral Research
      </div>

      <h2 className="text-2xl sm:text-3xl font-serif-luxury font-medium text-stone-900 mb-4">
        Analyzing Public Footprint for <span className="underline decoration-stone-300">{expertName}</span>
      </h2>

      <p className="text-sm text-stone-600 mb-8 max-w-md mx-auto">
        Evaluating available public data to reveal how prospective clients, peers, and media see you.
      </p>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 text-left space-y-3 shadow-xs max-w-md mx-auto">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <div
              key={step}
              className={`flex items-center gap-3 text-xs sm:text-sm transition-opacity duration-200 ${
                isDone
                  ? 'text-stone-900 font-medium'
                  : isCurrent
                  ? 'text-stone-950 font-semibold'
                  : 'text-stone-400 opacity-60'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : isCurrent ? (
                <div className="w-4 h-4 rounded-full border-2 border-stone-900 border-t-transparent animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-stone-300 shrink-0" />
              )}
              <span>{step}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-xs font-mono-code text-stone-400">
        Strict Grounding • Zero Invented Facts
      </div>
    </div>
  );
};
