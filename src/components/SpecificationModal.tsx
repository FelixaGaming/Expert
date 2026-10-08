import React from 'react';
import { X, CheckCircle, Shield } from 'lucide-react';

interface SpecificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecificationModal: React.FC<SpecificationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div>
            <div className="text-xs font-cinzel font-bold tracking-widest text-stone-500 uppercase">
              FELIXA EXPERTS MVP
            </div>
            <h2 className="text-xl font-serif-luxury font-semibold text-stone-900 mt-1">
              AI Build Specification v2.0
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              FELIXA helps bring out the best in people • Initial market: Experts • Advisors • Consultants
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6">
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-stone-100 text-stone-800 font-mono-code uppercase text-xs border-b border-stone-200">
                  <th className="p-3.5 font-bold w-1/3">Build Principle</th>
                  <th className="p-3.5 font-bold">Requirement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-700">
                <tr>
                  <td className="p-3.5 font-semibold text-stone-900 bg-stone-50/50">
                    Experience
                  </td>
                  <td className="p-3.5">
                    One question per screen. Minimal words. Large type. No complicated forms.
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-stone-900 bg-stone-50/50">
                    Product
                  </td>
                  <td className="p-3.5">
                    Current-state professional analytics. Do not ask the customer what they want to achieve.
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-stone-900 bg-stone-50/50">
                    Output
                  </td>
                  <td className="p-3.5">
                    A premium, evidence-based, beautifully formatted report with graphs, tables, timelines and clear guidance.
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-stone-900 bg-stone-50/50">
                    Trust
                  </td>
                  <td className="p-3.5">
                    No invented facts, scores, calculations, evidence, or methodology.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-2">
            <div className="font-semibold text-stone-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Compliance Verification
            </div>
            <p>
              • <strong>Strictly Zero Goals Asked:</strong> Interrogates only current factual delivery, billing, and client concentration.
            </p>
            <p>
              • <strong>One Question Per Screen:</strong> Focused, large editorial typography with keyboard selection (1–4) and no multi-field forms.
            </p>
            <p>
              • <strong>Mathematical Grounding:</strong> Herfindahl-Hirschman Index (HHI) for concentration risk, net realization yield formulas, and David Maister capacity modeling.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-xl text-xs font-medium cursor-pointer transition-colors"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
