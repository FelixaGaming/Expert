import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DailyQuota, JobStore } from '../jobs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'es-jobs-'));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => boolean, ms = 2000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(5); } };

test('jobs run one at a time when concurrency is 1, and the second shows its place in line', async () => {
  const store = new JobStore({ dir: tmp(), maxConcurrent: 1, ttlMs: 1e9 });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const a = store.create('report', async () => { await gate; return 'A'; });
  const b = store.create('report', async () => 'B');
  assert.equal(store.get(a.id)!.status, 'running');
  assert.equal(store.get(b.id)!.status, 'queued');
  assert.equal(store.get(b.id)!.queuePosition, 1);
  release();
  await until(() => store.get(b.id)!.status === 'done');
  assert.equal(store.get(a.id)!.result, 'A');
  assert.equal(store.get(b.id)!.result, 'B');
  store.shutdown();
});

test('a failing job reports a clear error and does not block the next one', async () => {
  const store = new JobStore({ dir: tmp(), maxConcurrent: 1, ttlMs: 1e9 });
  const bad = store.create('plan', async () => { throw Object.assign(new Error('Provider said no'), { code: 'PROVIDER_ERROR' }); });
  const good = store.create('plan', async () => 42);
  await until(() => store.get(good.id)!.status === 'done');
  assert.equal(store.get(bad.id)!.status, 'error');
  assert.equal(store.get(bad.id)!.error!.message, 'Provider said no');
  assert.equal(store.get(bad.id)!.error!.code, 'PROVIDER_ERROR');
  store.shutdown();
});

test('cancelling a running job aborts it; cancelling a queued job removes it', async () => {
  const store = new JobStore({ dir: tmp(), maxConcurrent: 1, ttlMs: 1e9 });
  let aborted = false;
  const running = store.create('report', ({ signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => { aborted = true; rej(new Error('stopped')); })));
  const queued = store.create('report', async () => 'never');
  assert.equal(store.cancel(queued.id), true);
  assert.equal(store.get(queued.id)!.status, 'cancelled');
  assert.equal(store.cancel(running.id), true);
  await until(() => aborted);
  assert.equal(store.get(running.id)!.status, 'cancelled');
  assert.equal(store.cancel(running.id), false);
  store.shutdown();
});

test('progress text is visible while a job runs', async () => {
  const store = new JobStore({ dir: tmp(), maxConcurrent: 1, ttlMs: 1e9 });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const j = store.create('report', async ({ progress }) => { progress('Reading pages'); await gate; return 1; });
  await until(() => store.get(j.id)!.stage === 'Reading pages');
  release();
  await until(() => store.get(j.id)!.status === 'done');
  store.shutdown();
});

test('finished jobs survive a restart; jobs that were running are marked as interrupted', async () => {
  const dir = tmp();
  const first = new JobStore({ dir, maxConcurrent: 1, ttlMs: 1e9 });
  const done = first.create('report', async () => ({ hello: 'world' }));
  await until(() => first.get(done.id)!.status === 'done');
  const hang = first.create('plan', () => new Promise(() => {}));
  await until(() => first.get(hang.id)!.status === 'running');
  first.shutdown();

  const second = new JobStore({ dir, maxConcurrent: 1, ttlMs: 1e9 });
  assert.deepEqual(second.get(done.id)!.result, { hello: 'world' });
  const view = second.get(hang.id)!;
  assert.equal(view.status, 'error');
  assert.equal(view.error!.code, 'RESTARTED');
  second.shutdown();
});

test('old results are deleted after the retention time', async () => {
  const dir = tmp();
  let now = 1_000_000;
  const store = new JobStore({ dir, maxConcurrent: 1, ttlMs: 60_000, now: () => now });
  const j = store.create('report', async () => 'x');
  await until(() => store.get(j.id)!.status === 'done');
  assert.ok(fs.existsSync(path.join(dir, `${j.id}.json`)));
  now += 61_000;
  store.sweep();
  assert.equal(store.get(j.id), undefined);
  assert.equal(fs.existsSync(path.join(dir, `${j.id}.json`)), false);
  store.shutdown();
});

test('daily limits: per visitor, overall, and reset on a new day', () => {
  let day = '2026-10-10';
  const q = new DailyQuota(2, 3, () => day);
  assert.equal(q.take('a'), null);
  assert.equal(q.take('a'), null);
  assert.match(q.take('a')!, /limit of 2/);
  assert.equal(q.take('b'), null); // global is now 3
  assert.match(q.take('c')!, /daily limit/);
  day = '2026-10-11';
  assert.equal(q.take('a'), null);
});
