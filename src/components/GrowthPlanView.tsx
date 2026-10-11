import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Printer, AlertTriangle } from 'lucide-react';
import type { GrowthPlan, LinkState, Money, Opportunity } from '../../growth';

interface Props {
  plan: GrowthPlan;
  onBack: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  award: 'Award', speaking: 'Speaking', media: 'Media', publication: 'Publication', grant: 'Grant', membership: 'Membership', training: 'Training', partnership: 'Partnership', other: 'Other',
};

const LINK: Record<LinkState, { text: string; cls: string }> = {
  'opened-matches': { text: 'Link opened and matches', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  'opened-no-match': { text: 'Page opened but may not match. Check it', cls: 'text-amber-900 bg-amber-50 border-amber-200' },
  'could-not-open': { text: 'Link could not be opened. Check it yourself', cls: 'text-stone-700 bg-stone-100 border-stone-300' },
  'no-link': { text: 'No link given. Search for it', cls: 'text-stone-700 bg-stone-100 border-stone-300' },
};

const Section: React.FC<{ n: number; title: string; intro?: string; children: React.ReactNode }> = ({ n, title, intro, children }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold text-stone-950 mb-1"><span className="text-stone-400 mr-2">{n}.</span>{title}</h2>
    {intro && <p className="text-sm text-stone-600 mb-4 max-w-3xl">{intro}</p>}
    <div className="space-y-4">{children}</div>
  </section>
);

const GAP_CLS: Record<string, string> = { small: 'bg-emerald-100 text-emerald-900 border-emerald-300', medium: 'bg-amber-100 text-amber-900 border-amber-300', large: 'bg-red-100 text-red-900 border-red-300' };

export const GrowthPlanView: React.FC<Props> = ({ plan, onBack }) => {
  const [filter, setFilter] = useState('all');
  const fmt = useMemo(() => {
    let f: Intl.NumberFormat;
    try { f = new Intl.NumberFormat('en', { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }); }
    catch { f = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }); }
    return (n: number) => f.format(n);
  }, [plan.currency]);
  const range = (m: Money) => (m.low === 0 && m.high === 0 ? 'Free' : m.low === m.high ? fmt(m.low) : `${fmt(m.low)} to ${fmt(m.high)}`);
  const byId = useMemo(() => new Map(plan.opportunities.map((o) => [o.id, o])), [plan.opportunities]);
  const types = useMemo(() => ['all', ...Array.from(new Set(plan.opportunities.map((o) => o.type)))], [plan.opportunities]);
  const shown = plan.opportunities.filter((o) => filter === 'all' || o.type === filter);

  const download = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ExpertScan_Plan_${plan.subjectName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const OppCard: React.FC<{ o: Opportunity }> = ({ o }) => (
    <div id={`opp-${o.id}`} className="rounded-xl border border-stone-200 bg-white p-4 text-sm scroll-mt-20">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[11px] font-mono-code text-stone-500">{o.id}</span>
        <strong className="text-stone-900">{o.name}</strong>
        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 border border-stone-300">{TYPE_LABEL[o.type] || o.type}</span>
        <span className="text-[11px] text-stone-500" title="How much this could help, from 1 to 5">Impact {'★'.repeat(o.impact)}{'☆'.repeat(5 - o.impact)}</span>
      </div>
      {o.organization && <p className="text-stone-600">{o.organization}</p>}
      <div className="grid sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-xs text-stone-700">
        <div><span className="text-stone-500">When: </span>{o.when}</div>
        <div><span className="text-stone-500">Cost: </span>{range(o.cost)}</div>
        <div><span className="text-stone-500">Time needed: </span>about {o.effortHours} hours</div>
      </div>
      {o.whyFit && <p className="mt-2"><span className="text-stone-500">Why it fits you: </span>{o.whyFit}</p>}
      {o.eligibility && <p className="text-xs text-stone-600 mt-1"><span className="text-stone-500">Who can apply: </span>{o.eligibility}</p>}
      {o.howToApply && <p className="text-xs text-stone-600 mt-1"><span className="text-stone-500">How to apply: </span>{o.howToApply}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-800 underline break-all">{o.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70)} <ExternalLink className="w-3 h-3 shrink-0" /></a>}
        <span className={`text-[11px] px-2 py-0.5 rounded border ${LINK[o.linkState].cls}`}>{LINK[o.linkState].text}</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-stone-200 text-xs">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Back to report</button>
        <div className="flex gap-2">
          <button onClick={download} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"><Download className="w-3.5 h-3.5" /> Download data</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg cursor-pointer"><Printer className="w-3.5 h-3.5" /> Print or save as PDF</button>
        </div>
      </div>

      <header className="mb-6">
        <div className="text-xs font-mono-code text-stone-500 uppercase tracking-wider">ExpertScan · Path to the top · {new Date(plan.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-stone-950 mt-1">{plan.subjectName}</h1>
        {plan.field && <p className="text-stone-600 mt-1">Field: {plan.field}</p>}
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 mb-8 text-sm text-stone-800" role="note">
        <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1"><AlertTriangle className="w-4 h-4" /> Please read</div>
        <ul className="list-disc pl-5 space-y-1">{plan.disclaimer.map((d) => <li key={d}>{d}</li>)}</ul>
        <p className="mt-2 text-xs">We found {plan.checks.opportunities} opportunities. The server opened {plan.checks.opened} of their links, and {plan.checks.matching} pages matched the name. {plan.checks.couldNotOpen > 0 ? `${plan.checks.couldNotOpen} links could not be opened.` : ''}</p>
      </div>

      <Section n={1} title="What the top looks like" intro={plan.definitionOfTop}>
        {plan.benchmarks.map((b) => (
          <div key={b.name} className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <h3 className="font-semibold">{b.name}</h3>
            <p className="text-stone-700">{b.whyBenchmark}</p>
            {b.milestones.length > 0 && <ul className="list-disc pl-5 mt-1 text-stone-700">{b.milestones.map((m) => <li key={m}>{m}</li>)}</ul>}
            {b.sourceUrl && <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline text-stone-600 break-all">{b.sourceUrl}</a>}
            {b.sourceUrl && <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border ${LINK[b.linkState].cls}`}>{LINK[b.linkState].text}</span>}
          </div>
        ))}
      </Section>

      <Section n={2} title="Where you stand now" intro={plan.currentStanding}>
        {plan.gaps.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-stone-500 text-xs"><tr><th className="py-1.5 pr-3">Area</th><th className="pr-3">You today</th><th className="pr-3">At the top</th><th>Gap</th></tr></thead>
              <tbody>
                {plan.gaps.map((g) => (
                  <tr key={g.area} className="border-t border-stone-200 align-top">
                    <td className="py-2 pr-3 font-medium capitalize">{g.area}</td><td className="pr-3">{g.now}</td><td className="pr-3">{g.topLevel}</td>
                    <td><span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${GAP_CLS[g.gapSize]}`}>{g.gapSize}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={3} title="The easiest pathway" intro="Steps are ordered by how much they help for the effort. Quick wins come first, and some steps unlock bigger ones.">
        {plan.pathway.map((ph) => (
          <div key={ph.phase} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <h3 className="font-semibold text-stone-900">{ph.phase}</h3>
              <span className="text-xs text-stone-500">About {ph.totalHours} hours · {range(ph.totalCost)}</span>
            </div>
            {ph.goal && <p className="text-sm text-stone-600 mb-3">{ph.goal}</p>}
            <ol className="space-y-3 list-decimal pl-5">
              {ph.steps.map((st, i) => (
                <li key={i} className="text-sm">
                  <p className="text-stone-900">{st.action}</p>
                  {st.why && <p className="text-xs text-stone-600">{st.why}</p>}
                  <p className="text-xs text-stone-500">About {st.effortHours} hours · {range(st.cost)}
                    {st.opportunityIds.length > 0 && <> · See: {st.opportunityIds.map((id) => <a key={id} href={`#opp-${id}`} className="underline mr-1">{byId.get(id)?.name || id}</a>)}</>}
                    {st.dependsOn.length > 0 && <> · Needs first: {st.dependsOn.map((id) => <a key={id} href={`#opp-${id}`} className="underline mr-1">{byId.get(id)?.name || id}</a>)}</>}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Section>

      <Section n={4} title="Real opportunities" intro="Best first. Open each link and confirm the dates and fees before you apply or pay.">
        <div className="no-print flex flex-wrap gap-1.5 text-xs">
          {types.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1 rounded-md cursor-pointer ${filter === t ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
              {t === 'all' ? `All (${plan.opportunities.length})` : `${TYPE_LABEL[t] || t} (${plan.opportunities.filter((o) => o.type === t).length})`}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className="text-sm text-stone-500 italic">No opportunities were found for this filter.</p> : shown.map((o) => <OppCard key={o.id} o={o} />)}
      </Section>

      <Section n={5} title="Budget" intro="Estimates with their assumptions. Totals are added up by the server. This is what it may cost to do the plan, not a forecast of income.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-stone-500 text-xs"><tr><th className="py-1.5 pr-3">Item</th><th className="pr-3">Type</th><th className="pr-3">When</th><th className="pr-3 text-right">Cost</th><th>Assumption</th></tr></thead>
            <tbody>
              {plan.budget.lineItems.map((l, i) => (
                <tr key={i} className="border-t border-stone-200 align-top">
                  <td className="py-2 pr-3">{l.item}</td><td className="pr-3 text-stone-600">{l.category}</td><td className="pr-3 text-stone-600">{l.when}</td>
                  <td className="pr-3 text-right whitespace-nowrap">{range({ low: l.low, high: l.high })}</td><td className="text-xs text-stone-600">{l.assumption}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-stone-900 font-semibold"><td className="py-2" colSpan={3}>Total</td><td className="text-right whitespace-nowrap pr-3">{range(plan.budget.total)}</td><td /></tr>
              <tr className="text-stone-600"><td className="py-1" colSpan={3}>Cost of all pathway steps added together (a second estimate)</td><td className="text-right whitespace-nowrap pr-3">{range(plan.budget.pathwayTotal)}</td><td /></tr>
            </tbody>
          </table>
        </div>
        {Object.keys(plan.budget.byCategory).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(plan.budget.byCategory).map(([c, m]) => <span key={c} className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">{c}: {range(m)}</span>)}
          </div>
        )}
        {plan.budget.withinCap !== null && (
          <p className={`text-sm font-medium ${plan.budget.withinCap ? 'text-emerald-800' : 'text-amber-900'}`}>
            {plan.budget.withinCap ? `Both estimates fit inside your limit of ${fmt(parseFloat(plan.answers.budgetCap))}.` : `The higher estimate is above your limit of ${fmt(parseFloat(plan.answers.budgetCap))}. Start with the free and low-cost steps, or spread the plan over a longer time.`}
          </p>
        )}
        {plan.budget.notes.length > 0 && <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{plan.budget.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </Section>

      <Section n={6} title="Everything else you need">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-stone-200 bg-white p-4"><h3 className="font-semibold mb-1">Time</h3><p>{plan.resourcesNeeded.hoursPerWeek || 'Not stated'}</p></div>
          <div className="rounded-xl border border-stone-200 bg-white p-4"><h3 className="font-semibold mb-1">Skills</h3><ul className="list-disc pl-5">{plan.resourcesNeeded.skills.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="rounded-xl border border-stone-200 bg-white p-4"><h3 className="font-semibold mb-1">Tools</h3><ul className="list-disc pl-5">{plan.resourcesNeeded.tools.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="rounded-xl border border-stone-200 bg-white p-4"><h3 className="font-semibold mb-1">People who can help</h3><ul className="list-disc pl-5">{plan.resourcesNeeded.people.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </Section>

      <Section n={7} title="How you will know it is working">
        {plan.successMarkers.length === 0 ? <p className="text-sm text-stone-500 italic">No markers were given.</p> : (
          <table className="w-full text-sm text-left">
            <thead className="text-stone-500 text-xs"><tr><th className="py-1.5 pr-3">Milestone</th><th className="pr-3">By</th><th>How to measure</th></tr></thead>
            <tbody>{plan.successMarkers.map((m) => <tr key={m.milestone} className="border-t border-stone-200 align-top"><td className="py-2 pr-3">{m.milestone}</td><td className="pr-3 whitespace-nowrap">{m.by}</td><td className="text-stone-600">{m.howToMeasure}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      {plan.assumptions.length > 0 && (
        <Section n={8} title="What we assumed">
          <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Section>
      )}
    </div>
  );
};
