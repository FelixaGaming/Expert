import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runModel } from '../ai';

// A fake `claude` that never reads its input. Cancelling around the moment it starts must not crash the server.
function withFakeClaude<T>(fn: () => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es-fake-'));
  fs.writeFileSync(path.join(dir, 'claude'), '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
  const old = process.env.PATH;
  process.env.PATH = `${dir}:${old}`;
  return fn().finally(() => { process.env.PATH = old; });
}

const cfg = { provider: 'claude-cli' as const, apiKey: '', model: 'haiku' };

test('cancelling before Claude starts ends the job cleanly without crashing', async () => {
  let crashed: unknown = null;
  const onErr = (e: unknown) => { crashed = e; };
  process.once('uncaughtException', onErr);
  await withFakeClaude(async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(runModel(cfg, 'a long prompt '.repeat(5000), false, undefined, undefined, ac.signal), (e: any) => e.code === 'CANCELLED');
    await new Promise((r) => setTimeout(r, 300)); // give a late "broken pipe" time to appear
  });
  process.removeListener('uncaughtException', onErr);
  assert.equal(crashed, null);
});

test('cancelling while Claude runs stops it quickly', async () => {
  await withFakeClaude(async () => {
    const ac = new AbortController();
    const started = Date.now();
    const p = runModel(cfg, 'hello', false, undefined, undefined, ac.signal);
    setTimeout(() => ac.abort(), 100);
    await assert.rejects(p, (e: any) => e.code === 'CANCELLED');
    assert.ok(Date.now() - started < 2000);
  });
});
