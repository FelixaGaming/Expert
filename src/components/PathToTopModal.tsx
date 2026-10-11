import React, { useState } from 'react';
import { X, Rocket } from 'lucide-react';
import type { PlanAnswers } from '../../growth';

interface Props {
  isOpen: boolean;
  subjectName: string;
  onClose: () => void;
  onCreate: (answers: PlanAnswers) => void;
}

const FOCUS: [string, string][] = [
  ['awards', 'Awards and recognition'], ['speaking', 'Speaking and conferences'], ['media', 'Media, podcasts and press'],
  ['publications', 'Publications and research'], ['funding', 'Grants and funding'], ['credentials', 'Credentials and training'], ['network', 'Partnerships and boards'],
];
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'PLN', 'AUD', 'SEK'];

export const PathToTopModal: React.FC<Props> = ({ isOpen, subjectName, onClose, onCreate }) => {
  const [goal, setGoal] = useState('');
  const [budgetCap, setBudgetCap] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [hours, setHours] = useState('');
  const [location, setLocation] = useState('');
  const [focus, setFocus] = useState<string[]>(FOCUS.map(([k]) => k));

  if (!isOpen) return null;
  const toggle = (k: string) => setFocus((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ goal: goal.trim(), budgetCap: budgetCap.trim(), hoursPerWeek: hours.trim(), location: location.trim(), currency, focus });
  };

  const input = 'w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Path to the top">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2"><Rocket className="w-4 h-4" /> Path to the top for {subjectName}</h2>
            <p className="text-sm text-stone-600 mt-1">We use the report and search the web for real awards, speaking slots, media and grants, then build the easiest order of steps and a budget. Every answer below is optional, but they make the plan fit you.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-stone-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label htmlFor="pt-goal" className="block text-xs font-semibold text-stone-700 mb-1">What does "the top" mean to you?</label>
          <textarea id="pt-goal" rows={3} maxLength={600} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="For example: be invited to keynote at international conferences and advise governments on online safety." className={input} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="pt-budget" className="block text-xs font-semibold text-stone-700 mb-1">Most you can spend in total</label>
            <input id="pt-budget" inputMode="numeric" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} placeholder="Leave empty if not sure" className={input} />
          </div>
          <div>
            <label htmlFor="pt-cur" className="block text-xs font-semibold text-stone-700 mb-1">Currency</label>
            <select id="pt-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} className={input}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pt-hours" className="block text-xs font-semibold text-stone-700 mb-1">Hours per week you can give</label>
            <input id="pt-hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="For example 6" className={input} />
          </div>
          <div>
            <label htmlFor="pt-loc" className="block text-xs font-semibold text-stone-700 mb-1">Where you are based</label>
            <input id="pt-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City and country" className={input} />
          </div>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-stone-700 mb-1">What should the plan cover?</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {FOCUS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={focus.includes(k)} onChange={() => toggle(k)} /> {label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-stone-500">This takes about 10 to 20 minutes because Claude searches and opens real pages. Please keep the page open. The plan is guidance, not a promise.</p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 cursor-pointer">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 cursor-pointer">Create my plan</button>
        </div>
      </form>
    </div>
  );
};
