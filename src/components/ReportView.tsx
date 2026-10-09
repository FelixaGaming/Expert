import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, Printer, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Disclaimer } from './Disclaimer';
import { MethodologyModal } from './MethodologyModal';
import type {
  CommentAuthor, DimensionScore, EvidenceStatus, Finding, RecognitionKind, ReportV2, SourceRecord,
} from '../../report-types';

interface Props {
  report: ReportV2;
  onRetake: () => void;
  onManageSources: () => void;
}

// ---------- Evidence status labels ----------

const STATUS: Record<EvidenceStatus, { label: string; meaning: string; cls: string }> = {
  verified: { label: 'Verified', meaning: 'A reliable source that is not written by the person confirms it.', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  'self-reported': { label: 'Self-reported', meaning: 'The person says this on their own site or profile.', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  observed: { label: 'Observed', meaning: 'A real public comment, review or reaction that we found.', cls: 'bg-teal-100 text-teal-900 border-teal-300' },
  inference: { label: 'Inference', meaning: 'Our interpretation of the evidence. The reasoning is shown.', cls: 'bg-violet-100 text-violet-900 border-violet-300' },
  hypothesis: { label: 'Hypothesis', meaning: 'A possible explanation without enough evidence. It needs checking.', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  unknown: { label: 'Not proven', meaning: 'The sources do not say, or do not support it well enough.', cls: 'bg-stone-100 text-stone-700 border-stone-300' },
};

const StatusChip: React.FC<{ status: EvidenceStatus }> = ({ status }) => (
  <span title={STATUS[status].meaning} className={`inline-block shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border ${STATUS[status].cls}`}>
    {STATUS[status].label}
  </span>
);

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
};

// ---------- Evidence panel ----------

const SourceCard: React.FC<{ source: SourceRecord; quote?: string; quoteChecked?: boolean }> = ({ source, quote, quoteChecked }) => (
  <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs space-y-1.5">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-mono-code font-semibold text-stone-500">{source.id}</span>
      <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-stone-900 hover:underline inline-flex items-center gap-1 break-all">
        {source.title} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    </div>
    <div className="text-stone-500">{source.kind} · accessed {fmtDate(source.accessedAt)}{source.published ? ` · published ${source.published}` : ''}</div>
    {quote && (
      <blockquote className="border-l-2 border-stone-300 pl-2 text-stone-700 italic">
        “{quote}”
        <span className={`not-italic ml-2 font-semibold ${quoteChecked ? 'text-emerald-700' : 'text-amber-700'}`}>
          {quoteChecked ? 'Quote found in the source' : 'Quote not confirmed'}
        </span>
      </blockquote>
    )}
    {!quote && source.excerpt && <p className="text-stone-600 line-clamp-3">{source.excerpt}</p>}
    {source.flags.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {source.flags.map((f) => (
          <span key={f} className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900">{f}</span>
        ))}
      </div>
    )}
  </div>
);

const EvidenceToggle: React.FC<{ ids: string[]; sources: Map<string, SourceRecord>; quote?: string; quoteChecked?: boolean }> = ({ ids, sources, quote, quoteChecked }) => {
  const [open, setOpen] = useState(false);
  if (!ids.length) return <span className="text-[11px] text-stone-400">No source</span>;
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen(!open)} className="no-print inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 cursor-pointer">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Evidence ({ids.length})
      </button>
      {open && (
        <div className="mt-1.5 space-y-2">
          {ids.map((id, i) => sources.get(id) && <SourceCard key={id} source={sources.get(id)!} quote={i === 0 ? quote : undefined} quoteChecked={quoteChecked} />)}
        </div>
      )}
    </div>
  );
};

const FindingList: React.FC<{ items: Finding[]; sources: Map<string, SourceRecord>; empty?: string }> = ({ items, sources, empty }) => {
  if (!items.length) return <p className="text-sm text-stone-500 italic">{empty || 'No public evidence found.'}</p>;
  return (
    <ul className="space-y-3">
      {items.map((f, i) => (
        <li key={i} className="text-sm text-stone-800 leading-relaxed">
          <div className="flex items-start gap-2">
            <StatusChip status={f.status} />
            <div className="min-w-0">
              <p>{f.text}</p>
              {f.reasoning && <p className="text-xs text-stone-600 mt-0.5"><span className="font-semibold">Why: </span>{f.reasoning}</p>}
              {f.note && <p className="text-xs text-amber-800 mt-0.5">{f.note}</p>}
              <EvidenceToggle ids={f.sources} sources={sources} quote={f.excerpt} quoteChecked={f.excerptVerified} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

const Section: React.FC<{ id: string; n: number; title: string; intro?: string; children: React.ReactNode }> = ({ id, n, title, intro, children }) => (
  <section id={id} className="mb-10 scroll-mt-20">
    <h2 className="text-xl font-semibold text-stone-950 mb-1"><span className="text-stone-400 mr-2">{n}.</span>{title}</h2>
    {intro && <p className="text-sm text-stone-600 mb-4 max-w-3xl">{intro}</p>}
    <div className="space-y-5">{children}</div>
  </section>
);

const Sub: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-mono-code uppercase tracking-wider text-stone-500 mb-2">{title}</h3>
    {children}
  </div>
);

const KIND_LABEL: Record<RecognitionKind, string> = {
  invited: 'Invited to take part', delivered: 'Took part (delivered)', appointed: 'Official appointment', contributed: 'Contributed to work', mentioned: 'Only mentioned',
};
const AUTHOR_LABEL: Record<CommentAuthor, string> = {
  'third-party': 'Written by other people', subject: 'Written by the person', organization: 'Promotional or from their organization',
};

// ---------- Scores ----------

const ScoreCard: React.FC<{ d: DimensionScore; sources: Map<string, SourceRecord> }> = ({ d, sources }) => {
  const [open, setOpen] = useState(false);
  const RATING: Record<string, string> = { strong: 'Strong evidence', partial: 'Partial evidence', none_found: 'No public evidence found', unknown: 'Could not be judged' };
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-stone-900">{d.label}</h4>
          <p className="text-xs text-stone-600">{d.question}</p>
        </div>
        <div className="text-right shrink-0">
          {d.score === null ? (
            <div className="text-sm font-semibold text-stone-600">Not enough evidence to score</div>
          ) : (
            <div className="text-2xl font-semibold text-stone-950">{d.score}<span className="text-sm text-stone-400">/100</span></div>
          )}
          <div className="text-[11px] text-stone-500">{Math.round(d.coverage * 100)}% of the checklist could be judged</div>
        </div>
      </div>
      <button onClick={() => setOpen(!open)} className="no-print mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} How this was calculated
      </button>
      {open && (
        <div className="mt-2 text-xs space-y-2">
          <table className="w-full text-left">
            <thead className="text-stone-500"><tr><th className="py-1 pr-2">Checklist item</th><th className="pr-2">Weight</th><th className="pr-2">Result</th><th>Sources</th></tr></thead>
            <tbody>
              {d.indicators.map((x) => (
                <tr key={x.key} className="border-t border-stone-100 align-top">
                  <td className="py-1 pr-2">{x.label}</td>
                  <td className="pr-2">{x.weight}</td>
                  <td className="pr-2">{RATING[x.rating]}{x.note ? ` (${x.note})` : ''}</td>
                  <td className="font-mono-code">{x.sources.map((id) => sources.get(id) && (
                    <a key={id} href={sources.get(id)!.url} target="_blank" rel="noreferrer" className="mr-1 underline">{id}</a>
                  ))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-stone-600"><strong>Limits:</strong> {d.limitations}</p>
          <p className="text-stone-500">Strong counts as full weight, partial as half, none found as zero. Items that could not be judged are left out. A score appears only when at least half the weight could be judged.</p>
        </div>
      )}
    </div>
  );
};

// ---------- Report ----------

export const ReportView: React.FC<Props> = ({ report, onRetake, onManageSources }) => {
  const [showMethod, setShowMethod] = useState(false);
  const sources = useMemo(() => new Map(report.sources.map((s) => [s.id, s])), [report.sources]);
  const p = report.profile;

  const download = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ExpertScan_${report.subjectName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const confidenceCls = { low: 'bg-red-100 text-red-900 border-red-300', medium: 'bg-amber-100 text-amber-900 border-amber-300', high: 'bg-emerald-100 text-emerald-900 border-emerald-300' }[report.executive.confidence];
  const nav = [
    ['s1', '1 Summary'], ['s2', '2 Profile'], ['s3', '3 Discoverability'], ['s4', '4 Reputation'], ['s5', '5 Perception'],
    ['s6', '6 Peers'], ['s7', '7 Gaps and risks'], ['s8', '8 Recommendations'], ['s9', '9 Evidence'],
  ];

  return (
    <div id="report-view-root" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200">
        <div className="text-xs font-mono-code uppercase tracking-wider text-stone-500">ExpertScan report · based on public information</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setShowMethod(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"><ShieldCheck className="w-3.5 h-3.5" /> How we work</button>
          <button onClick={download} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"><Download className="w-3.5 h-3.5" /> Download data</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg cursor-pointer"><Printer className="w-3.5 h-3.5" /> Print or save as PDF</button>
          <button onClick={onRetake} className="inline-flex items-center gap-1.5 px-3 py-2 text-stone-600 hover:text-stone-900 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> New search</button>
        </div>
      </div>

      <nav className="no-print flex flex-wrap gap-1.5 mb-6 text-xs">
        {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700">{label}</a>)}
      </nav>

      <header className="mb-6">
        <div className="text-xs font-mono-code text-stone-500 uppercase tracking-wider">ExpertScan · Public footprint report · {fmtDate(report.generatedAt)}</div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-stone-950 mt-1">{report.subjectName}</h1>
      </header>

      {report.provisional && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-5 text-sm text-amber-950" role="status">
          <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle className="w-4 h-4" /> This report is provisional</div>
          <p className="mb-1.5">The research was limited, so please treat the findings as a first look, not a final answer.</p>
          <ul className="list-disc pl-5">{report.provisionalReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      <Disclaimer coverage={report.coverage} />

      <div className="no-print rounded-xl border border-stone-200 bg-white p-4 mb-10 text-xs">
        <div className="font-semibold text-stone-800 mb-2">How to read the labels</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {(Object.keys(STATUS) as EvidenceStatus[]).map((s) => (
            <div key={s} className="flex items-start gap-2"><StatusChip status={s} /><span className="text-stone-600">{STATUS[s].meaning}</span></div>
          ))}
        </div>
      </div>

      {/* 1 */}
      <Section id="s1" n={1} title="Executive assessment" intro="The main findings, how sure we are, and what limits them.">
        <p className="text-lg text-stone-900 leading-relaxed">{report.executive.headline}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-2.5 py-1 rounded border font-semibold ${confidenceCls}`}>Confidence: {report.executive.confidence}</span>
          <span className="text-stone-700">{report.executive.confidenceWhy}</span>
        </div>
        <Sub title="Main findings"><FindingList items={report.executive.findings} sources={sources} /></Sub>
        {report.executive.limitations.length > 0 && (
          <Sub title="Important limits"><ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{report.executive.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Sub>
        )}
      </Section>

      {/* 2 */}
      <Section id="s2" n={2} title="Professional profile" intro="What public sources show about education, work, research and achievements. Not finding something does not mean it does not exist.">
        {([
          ['Education and qualifications', p.education], ['Work and experience', p.experience], ['Research and publications', p.research],
          ['Business, products and ownership', p.business], ['Awards and recognition', p.awards], ['Speaking, media and interviews', p.speakingMedia],
          ['Collaborations and partnerships', p.collaborations], ['Documented achievements and outcomes', p.achievements],
        ] as [string, Finding[]][]).map(([title, items]) => (
          <Sub key={title} title={title}><FindingList items={items} sources={sources} /></Sub>
        ))}
        {p.notFound.length > 0 && (
          <Sub title="Searched for but not found publicly">
            <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{p.notFound.map((n) => <li key={n}>{n}</li>)}</ul>
            <p className="text-xs text-stone-500 mt-1">These may still be true. Something real but unpublished does not show here.</p>
          </Sub>
        )}
      </Section>

      {/* 3 */}
      <Section id="s3" n={3} title="Public discoverability" intro="What an independent person could find about this person today.">
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-stone-200 bg-white p-3"><div className="text-2xl font-semibold">{report.coverage.sourcesUsed}</div>pages and records found</div>
          <div className="rounded-lg border border-stone-200 bg-white p-3"><div className="text-2xl font-semibold">{report.coverage.pagesRead}</div>read in full</div>
          <div className="rounded-lg border border-stone-200 bg-white p-3"><div className="text-2xl font-semibold">{report.sources.filter((s) => !s.selfAuthored && s.kind !== 'peer research').length}</div>not written by the person</div>
        </div>
        <p className="text-sm text-stone-700">
          <strong>Profiles found:</strong> {report.coverage.platformsFound.join(', ') || 'none'}.<br />
          <strong>No profile found on:</strong> {report.coverage.platformsNotFound.join(', ') || 'none'}. Some of these sites block automatic reading, so a profile may exist.
        </p>
        <FindingList items={report.discoverability.findings} sources={sources} />
        <button onClick={onManageSources} className="no-print text-xs underline text-stone-600 hover:text-stone-900 cursor-pointer">Add or check more pages</button>
      </Section>

      {/* 4 */}
      <Section id="s4" n={4} title="External reputation" intro="Real public reactions and recognition, kept apart from what the person says about themself. We never write comments ourselves.">
        <div className={`rounded-lg border p-3 text-sm ${report.reputation.sentiment.status === 'scored' ? 'border-stone-200 bg-white' : 'border-stone-300 bg-stone-50'}`}>
          <strong>Public mood: </strong>
          {report.reputation.sentiment.status === 'scored' && report.reputation.sentiment.counts
            ? `${Object.entries(report.reputation.sentiment.counts).map(([k, v]) => `${v} ${k}`).join(', ')}. `
            : 'Not enough evidence to score. '}
          {report.reputation.sentiment.note}
        </div>
        {report.reputation.droppedComments > 0 && (
          <p className="text-xs text-amber-800">{report.reputation.droppedComments} comment{report.reputation.droppedComments === 1 ? '' : 's'} suggested by the AI could not be found in any source and {report.reputation.droppedComments === 1 ? 'was' : 'were'} removed.</p>
        )}
        {(['third-party', 'subject', 'organization'] as CommentAuthor[]).map((a) => {
          const list = report.reputation.comments.filter((c) => c.author === a);
          if (!list.length) return null;
          return (
            <Sub key={a} title={AUTHOR_LABEL[a]}>
              <ul className="space-y-2">
                {list.map((c, i) => (
                  <li key={i} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                    <blockquote className="italic text-stone-800">“{c.text}”</blockquote>
                    <div className="text-xs text-stone-500 mt-1">{c.platform}{c.date ? ` · ${c.date}` : ''} · tone: {c.tone}{c.context ? ` · ${c.context}` : ''} · <a href={c.url} target="_blank" rel="noreferrer" className="underline">source {c.sourceId}</a></div>
                  </li>
                ))}
              </ul>
            </Sub>
          );
        })}
        {report.reputation.comments.length === 0 && <p className="text-sm text-stone-500 italic">No genuine comments or reviews could be collected.</p>}
        <Sub title="Recognition and activity">
          {report.reputation.recognition.length === 0 ? <p className="text-sm text-stone-500 italic">No documented recognition found.</p> : (
            <ul className="space-y-2">
              {report.reputation.recognition.map((r, i) => (
                <li key={i} className="text-sm"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 mr-2">{KIND_LABEL[r.kind]}</span>{r.text}
                  <EvidenceToggle ids={r.sources} sources={sources} /></li>
              ))}
            </ul>
          )}
        </Sub>
        <Sub title="Documented criticism"><FindingList items={report.reputation.criticism} sources={sources} empty="No documented criticism found in the sources we read. That does not prove there is none." /></Sub>
      </Section>

      {/* 5 */}
      <Section id="s5" n={5} title="Perception alignment" intro="Three different views are kept apart: how the person sees themself, how they present themself, and what independent sources show.">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-sm mb-2">Self-perception</h3>
            {report.perception.selfAssessmentGiven
              ? <FindingList items={report.perception.selfPerception} sources={sources} empty="The answers did not allow any conclusion." />
              : <p className="text-sm text-stone-500 italic">Unknown. It can only come from the person's own answers. Answer the optional questions before the search to fill this in.</p>}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-sm mb-2">Intended public identity</h3>
            <p className="text-xs text-stone-500 mb-2">What their own channels say.</p>
            <FindingList items={report.perception.intendedIdentity} sources={sources} />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-sm mb-2">Observed external perception</h3>
            <p className="text-xs text-stone-500 mb-2">What independent sources show.</p>
            <FindingList items={report.perception.observedExternal} sources={sources} empty="No independent evidence found." />
          </div>
        </div>
        <Sub title="Possible gaps">
          {report.perception.gaps.length === 0 ? <p className="text-sm text-stone-500 italic">No gap can be shown with the evidence found.</p> : (
            <ul className="space-y-3">
              {report.perception.gaps.map((g, i) => (
                <li key={i} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <div className="flex items-start gap-2"><StatusChip status={g.status} /><strong>{g.title}</strong></div>
                  <p className="mt-1"><span className="text-stone-500">Their own channels: </span>{g.intended}</p>
                  <p><span className="text-stone-500">Independent sources: </span>{g.observed}</p>
                  <p className="text-xs text-stone-600 mt-1"><span className="font-semibold">What would settle it: </span>{g.confirmWith}</p>
                  <EvidenceToggle ids={g.sources} sources={sources} />
                </li>
              ))}
            </ul>
          )}
        </Sub>
      </Section>

      {/* 6 */}
      <Section id="s6" n={6} title="Competitive positioning" intro={report.competitive.field ? `Comparable experts in: ${report.competitive.field}.` : 'Comparable experts.'}>
        <p className="text-sm text-stone-700">{report.competitive.note}</p>
        {report.competitive.peers.map((peer) => (
          <div key={peer.name} className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <h3 className="font-semibold">{peer.name}</h3>
            <p className="text-stone-700">{peer.whyComparable}</p>
            {peer.strongerThanSubject.length > 0 && <p className="mt-1"><span className="text-stone-500">Stronger in: </span>{peer.strongerThanSubject.join('; ')}</p>}
            {peer.moreVisibleIn.length > 0 && <p><span className="text-stone-500">More visible in: </span>{peer.moreVisibleIn.join('; ')}</p>}
            <EvidenceToggle ids={peer.sources} sources={sources} />
          </div>
        ))}
        <Sub title="Gaps worth addressing"><FindingList items={report.competitive.gapsWorthAddressing} sources={sources} empty="Not enough evidence to name gaps against peers." /></Sub>
      </Section>

      {/* 7 */}
      <Section id="s7" n={7} title="Gaps and risks" intro="What is missing, what does not match, and what may be out of date.">
        <Sub title="Missing evidence">
          {report.risks.missingEvidence.length ? <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{report.risks.missingEvidence.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-sm text-stone-500 italic">Nothing listed.</p>}
        </Sub>
        <Sub title="Things that do not match"><FindingList items={report.risks.inconsistencies} sources={sources} empty="No mismatches found." /></Sub>
        <Sub title="Possibly out of date"><FindingList items={report.risks.outdated} sources={sources} empty="Nothing flagged. Many sources show no date, so age is often unknown." /></Sub>
        <Sub title="Same-name risk (other people with this name)"><FindingList items={report.risks.duplicateIdentities} sources={sources} empty="No other same-name people were flagged. Please still check each source." /></Sub>
      </Section>

      {/* 8 */}
      <Section id="s8" n={8} title="Recommendations" intro="Most important first. Each one is tied to evidence and has a way to measure success. No income forecasts are made.">
        {report.recommendations.length === 0 ? <p className="text-sm text-stone-500 italic">Not enough evidence for reliable recommendations.</p> : report.recommendations.map((r, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold">{i + 1}. {r.title}</h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 border border-stone-300">Importance: {r.importance}</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 border border-stone-300">Effort: {r.effort}</span>
            </div>
            <p><span className="text-stone-500">Why: </span>{r.why}</p>
            {r.benefit && <p><span className="text-stone-500">Expected benefit: </span>{r.benefit}</p>}
            <p><span className="text-stone-500">How to measure success: </span>{r.successMeasure}</p>
            <EvidenceToggle ids={r.sources} sources={sources} />
          </div>
        ))}
      </Section>

      {/* 9 */}
      <Section id="s9" n={9} title="Evidence appendix" intro="Scores, every source we used, and how this report was made.">
        <Sub title="Scores (checked, not guessed)">
          <div className="grid md:grid-cols-2 gap-3">{report.scores.map((d) => <ScoreCard key={d.key} d={d} sources={sources} />)}</div>
          <p className="text-xs text-stone-500 mt-2">Professional skill, public visibility and popularity are different things and are not mixed.</p>
        </Sub>
        <Sub title={`Source list (${report.sources.length})`}>
          <div className="space-y-2">{report.sources.map((s) => <SourceCard key={s.id} source={s} />)}</div>
        </Sub>
        <Sub title="Method">
          <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">{report.methodology.map((m) => <li key={m}>{m}</li>)}</ul>
        </Sub>
      </Section>

      <MethodologyModal isOpen={showMethod} onClose={() => setShowMethod(false)} />
    </div>
  );
};
