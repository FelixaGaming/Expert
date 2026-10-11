// Reports and plans run as saved jobs on the server. The page starts one, checks on it, and remembers it,
// so a refresh, a sleeping phone or a dropped connection does not lose the work.
import { aiHeaders } from './ai-settings';

export interface JobView {
  id: string;
  kind: 'report' | 'plan';
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  stage: string;
  queuePosition: number;
  elapsedSeconds: number;
  result?: any;
  error?: { message: string; code?: string };
  subject?: string;
}

const KEY = 'expertscan.activeJob';

export function saveActiveJob(job: { id: string; kind: 'report' | 'plan' } | null) {
  try {
    if (job) localStorage.setItem(KEY, JSON.stringify(job));
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the job still works until the page is closed */ }
}

export function loadActiveJob(): { id: string; kind: 'report' | 'plan' } | null {
  try {
    const raw = localStorage.getItem(KEY);
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j.id === 'string' && (j.kind === 'report' || j.kind === 'plan') ? j : null;
  } catch {
    return null;
  }
}

export async function startJob(kind: 'report' | 'plan', payload: unknown): Promise<JobView> {
  let res: Response;
  try {
    res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', ...aiHeaders() }, body: JSON.stringify({ kind, payload }) });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) throw new Error(body?.error || `The server answered with an error (${res.status}).`);
  return body as JobView;
}

export async function cancelJob(id: string): Promise<void> {
  try { await fetch(`/api/jobs/${id}`, { method: 'DELETE' }); } catch { /* the job times out by itself */ }
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

// Checks on a job until it finishes. Short network problems are tolerated: the job keeps running on the server.
export async function watchJob(id: string, onUpdate: (j: JobView) => void, signal: AbortSignal): Promise<JobView> {
  let failures = 0;
  const started = Date.now();
  while (!signal.aborted) {
    try {
      const res = await fetch(`/api/jobs/${id}`, { cache: 'no-store' });
      if (res.status === 404) throw new Error('This job is no longer available. Please start it again.');
      if (res.ok) {
        failures = 0;
        const view = (await res.json()) as JobView;
        onUpdate(view);
        if (view.status === 'done' || view.status === 'error' || view.status === 'cancelled') return view;
      } else if (++failures > 20) throw new Error('The server is not answering. Your job may still be running: reload the page in a minute to check.');
    } catch (e) {
      if (e instanceof Error && /no longer available/.test(e.message)) throw e;
      if (++failures > 20) throw new Error('The connection was lost. Your job may still be running: reload the page in a minute to check.');
    }
    await sleep(Date.now() - started < 120_000 ? 3000 : 5000, signal);
  }
  throw new Error('Stopped.');
}
