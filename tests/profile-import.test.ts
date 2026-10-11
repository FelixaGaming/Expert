import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { importProfileFiles, parseCsv } from '../src/profile-import';

const zip = (files: Record<string, string>) => new File([zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))], 'export.zip');

test('CSV parser handles quotes, commas and line breaks inside fields', () => {
  const rows = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",z\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'line1\nline2'], ['say "hi"', 'z']]);
});

test('LinkedIn export: profile data is read, private files are never opened', async () => {
  const r = await importProfileFiles('LinkedIn', [zip({
    'Positions.csv': 'Company Name,Title\nCore Centre,Psychologist\n',
    'Honors.csv': 'Title,Issued On\nBig Award,2026\n',
    'messages.csv': 'FROM,CONTENT\nsomeone,PRIVATE MESSAGE\n',
    'Connections.csv': 'First Name,Email Address\nBob,bob@example.com\n',
  })]);
  assert.match(r.text, /Core Centre/);
  assert.match(r.text, /Big Award/);
  assert.doesNotMatch(r.text, /PRIVATE|bob@example/);
  assert.equal(r.filesRead.length, 2);
  assert.equal(r.filesSkipped, 2);
});

test('Facebook export: garbled accents are repaired and messages are skipped', async () => {
  const garble = (s: string) => Buffer.from(s, 'utf8').toString('latin1');
  const r = await importProfileFiles('Facebook', [zip({
    'your_facebook_activity/comments_and_reactions/comments.json': JSON.stringify({ comments_v2: [{ data: [{ comment: { comment: garble('Świetna prezentacja') } }] }] }),
    'your_facebook_activity/messages/inbox/chat/message_1.json': JSON.stringify({ messages: [{ content: 'PRIVATE' }] }),
  })]);
  assert.match(r.text, /Świetna prezentacja/);
  assert.doesNotMatch(r.text, /PRIVATE/);
});

test('a file with nothing readable gives empty text, not an error', async () => {
  const r = await importProfileFiles('LinkedIn', [zip({ 'random.txt': 'hello' })]);
  assert.equal(r.text, '');
});
