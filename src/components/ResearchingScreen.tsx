import React from 'react';
import { Globe } from 'lucide-react';
import type { JobView } from '../jobs-client';

interface ResearchingScreenProps {
  expertName: string;
  variant?: 'report' | 'plan';
  job?: JobView | null;
  onCancel?: () => void;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Shows what the server is really doing. The job keeps running if the page is closed or refreshed.
export const ResearchingScreen: React.FC<ResearchingScreenProps> = ({ expertName, variant = 'report', job, onCancel }) => {
  const waiting = job?.status === 'queued';
  return (
    <div id="researching-container" className="w-full max-w-xl mx-auto px-4 py-16 text-center">
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-stone-200 animate-ping opacity-25"></div>
        <div className="w-20 h-20 rounded-2xl bg-stone-900 text-stone-50 flex items-center justify-center shadow-lg relative">
          <Globe className="w-9 h-9 animate-pulse" />
        </div>
      </div>

      <div className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-2">
        {variant === 'plan' ? 'Working on your plan' : 'Working on your report'}
      </div>

      <h2 className="text-2xl sm:text-3xl font-serif-luxury font-medium text-stone-900 mb-4">
        {variant === 'plan' ? 'Building a plan for' : 'Building a report for'} <span className="underline decoration-stone-300">{expertName}</span>
      </h2>

      <div className="bg-white rounded-xl border border-stone-200 p-5 max-w-md mx-auto shadow-xs text-left" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-stone-900 border-t-transparent animate-spin shrink-0" />
          <span className="text-sm font-semibold text-stone-900">
            {waiting && job!.queuePosition > 0 ? `You are number ${job!.queuePosition} in line. Your work starts when a place is free.` : job?.stage || 'Starting...'}
          </span>
        </div>
        <div className="mt-3 text-xs text-stone-500 flex justify-between">
          <span>Time so far: {mmss(job?.elapsedSeconds ?? 0)}</span>
          <span>{variant === 'plan' ? 'Usually 10 to 20 minutes' : 'Usually 5 to 15 minutes'}</span>
        </div>
      </div>

      <p className="text-sm text-stone-600 mt-6 max-w-md mx-auto">
        You can close this page or put your phone away. The work keeps running, and your result will be here when you come back to this address on the same device.
      </p>

      {onCancel && (
        <button onClick={onCancel} className="mt-6 text-xs text-stone-500 underline hover:text-stone-800 cursor-pointer">Cancel and go back</button>
      )}

      <div className="mt-8 text-xs font-mono-code text-stone-400">
        We only use what we find online, so some details may be missing
      </div>
    </div>
  );
};
