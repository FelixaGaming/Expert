// Long-running work (reports and plans) runs as saved jobs, not as one open web request.
// A job survives a page refresh, a phone going to sleep and a dropped connection. Results are kept for a limited time and then deleted.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type JobKind = 'report' | 'plan';
export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  stage: string; // plain-language progress line
  result?: unknown;
  error?: { message: string; code?: string };
  subject?: string;
}

export interface JobView {
  id: string;
  kind: JobKind;
  status: JobStatus;
  stage: string;
  queuePosition: number; // 0 when not waiting
  elapsedSeconds: number;
  result?: unknown;
  error?: { message: string; code?: string };
  subject?: string;
}

export type JobFn = (ctx: { signal: AbortSignal; progress: (stage: string) => void }) => Promise<unknown>;

export interface JobStoreOptions {
  dir: string;
  maxConcurrent: number;
  ttlMs: number;
  now?: () => number;
}

interface Live { fn: JobFn; abort: AbortController }

export class JobStore {
  private jobs = new Map<string, Job>();
  private live = new Map<string, Live>();
  private queue: string[] = [];
  private running = 0;
  private timer?: NodeJS.Timeout;
  private readonly now: () => number;

  constructor(private opts: JobStoreOptions) {
    this.now = opts.now ?? Date.now;
    fs.mkdirSync(opts.dir, { recursive: true });
    this.loadFromDisk();
    this.timer = setInterval(() => this.sweep(), 10 * 60_000);
    this.timer.unref();
  }

  // Jobs that were running when the server stopped cannot continue: they are marked clearly instead of hanging forever
  private loadFromDisk() {
    for (const f of fs.readdirSync(this.opts.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const job: Job = JSON.parse(fs.readFileSync(path.join(this.opts.dir, f), 'utf8'));
        if (job.status === 'queued' || job.status === 'running') {
          job.status = 'error';
          job.finishedAt = this.now();
          job.stage = 'Stopped';
          job.error = { message: 'The server restarted while this was running. Nothing was lost on your side. Please start it again.', code: 'RESTARTED' };
          this.persist(job);
        }
        this.jobs.set(job.id, job);
      } catch { /* ignore a damaged file */ }
    }
    this.sweep();
  }

  private persist(job: Job) {
    const file = path.join(this.opts.dir, `${job.id}.json`);
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(job));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.warn('Could not save job', job.id, e instanceof Error ? e.message : e);
    }
  }

  // Deletes old results: they contain personal information and are not kept longer than needed
  sweep() {
    const cutoff = this.now() - this.opts.ttlMs;
    for (const [id, job] of this.jobs) {
      const end = job.finishedAt ?? job.createdAt;
      if (job.status !== 'queued' && job.status !== 'running' && end < cutoff) {
        this.jobs.delete(id);
        try { fs.unlinkSync(path.join(this.opts.dir, `${id}.json`)); } catch { /* already gone */ }
      }
    }
  }

  create(kind: JobKind, fn: JobFn, subject?: string): Job {
    const job: Job = { id: crypto.randomBytes(16).toString('hex'), kind, status: 'queued', createdAt: this.now(), stage: 'Waiting for a free slot', subject };
    this.jobs.set(job.id, job);
    this.live.set(job.id, { fn, abort: new AbortController() });
    this.queue.push(job.id);
    this.persist(job);
    this.pump();
    return job;
  }

  private pump() {
    while (this.running < this.opts.maxConcurrent && this.queue.length) {
      const id = this.queue.shift()!;
      const job = this.jobs.get(id);
      const live = this.live.get(id);
      if (!job || !live || job.status !== 'queued') continue;
      this.running++;
      job.status = 'running';
      job.startedAt = this.now();
      job.stage = 'Starting';
      this.persist(job);
      live.fn({ signal: live.abort.signal, progress: (stage) => { job.stage = stage; } })
        .then((result) => {
          if (job.status === 'cancelled') return;
          job.status = 'done';
          job.result = result;
          job.stage = 'Done';
        })
        .catch((e: unknown) => {
          if (job.status === 'cancelled') return;
          job.status = 'error';
          job.stage = 'Stopped';
          const err = e as { message?: string; code?: string };
          job.error = { message: err?.message || 'Something went wrong. Please try again.', code: err?.code };
        })
        .finally(() => {
          job.finishedAt = this.now();
          this.live.delete(id);
          this.running--;
          this.persist(job);
          this.pump();
        });
    }
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return false;
    job.status = 'cancelled';
    job.stage = 'Cancelled';
    job.finishedAt = this.now();
    this.live.get(id)?.abort.abort();
    this.queue = this.queue.filter((q) => q !== id);
    this.persist(job);
    return true;
  }

  get(id: string): JobView | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const waiting = job.status === 'queued' ? this.queue.indexOf(id) + 1 : 0;
    const end = job.finishedAt ?? this.now();
    return {
      id: job.id, kind: job.kind, status: job.status, stage: job.stage, queuePosition: waiting,
      elapsedSeconds: Math.max(0, Math.round((end - (job.startedAt ?? job.createdAt)) / 1000)),
      result: job.status === 'done' ? job.result : undefined, error: job.error, subject: job.subject,
    };
  }

  stats() {
    return { queued: this.queue.length, running: this.running, stored: this.jobs.size };
  }

  // Stops everything that is running (used when the server shuts down)
  shutdown() {
    for (const live of this.live.values()) live.abort.abort();
    if (this.timer) clearInterval(this.timer);
  }
}

// ---------- Fair use: limits per visitor and per day ----------

export class DailyQuota {
  private perIp = new Map<string, { day: string; count: number }>();
  private global = { day: '', count: 0 };

  constructor(private perIpLimit: number, private globalLimit: number, private today: () => string = () => new Date().toISOString().slice(0, 10)) {}

  // Returns an error message when a limit is reached, otherwise counts the job and returns null
  take(ip: string): string | null {
    const day = this.today();
    if (this.global.day !== day) this.global = { day, count: 0 };
    const entry = this.perIp.get(ip);
    const mine = entry && entry.day === day ? entry : { day, count: 0 };
    if (this.perIpLimit > 0 && mine.count >= this.perIpLimit) return `You have reached today's limit of ${this.perIpLimit} reports or plans. Please come back tomorrow.`;
    if (this.globalLimit > 0 && this.global.count >= this.globalLimit) return 'ExpertScan has reached its daily limit. Please try again tomorrow.';
    mine.count++;
    this.global.count++;
    this.perIp.set(ip, mine);
    return null;
  }
}
