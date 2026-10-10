// Reads a person's own LinkedIn or Facebook data download and turns it into plain text for the report.
// Everything runs in the browser. Only an allowlist of profile and public-activity files is read:
// messages, contacts, connections, ads, logins and similar private data are never opened.
import { unzipSync, strFromU8 } from 'fflate';

export type ImportPlatform = 'LinkedIn' | 'Facebook';

export interface ImportResult {
  text: string;
  filesRead: string[];
  filesSkipped: number;
  truncated: boolean;
}

const MAX_CHARS = 60_000;

// ---------- CSV ----------

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  const text = input.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// ---------- LinkedIn ----------

// File name (lower case, without folders) -> what it is called in the report. Anything else is ignored.
const LINKEDIN_FILES: [RegExp, string][] = [
  [/^profile\.csv$/, 'Profile'],
  [/^profile summary\.csv$/, 'Profile summary'],
  [/^positions\.csv$/, 'Positions'],
  [/^education\.csv$/, 'Education'],
  [/^honors\.csv$/, 'Honors and awards'],
  [/^publications\.csv$/, 'Publications'],
  [/^projects\.csv$/, 'Projects'],
  [/^certifications\.csv$/, 'Certifications'],
  [/^courses\.csv$/, 'Courses'],
  [/^patents\.csv$/, 'Patents'],
  [/^volunteering\.csv$/, 'Volunteering'],
  [/^languages\.csv$/, 'Languages'],
  [/^skills\.csv$/, 'Skills'],
  [/^recommendations_received\.csv$/, 'Recommendations received from other people'],
  [/^shares\.csv$/, 'Posts'],
  [/^comments\.csv$/, 'Comments written'],
  [/^articles?\.csv$/, 'Articles'],
  [/^featured\.csv$/, 'Featured'],
];

const LINKEDIN_SKIP_COLUMNS = /^(url|link|sharelink|sharecommentary url|mediaurl|visibility|status|id|urn)$/i;

function linkedinFileToText(label: string, csv: string): string {
  const rows = parseCsv(csv);
  if (rows.length < 2) return '';
  const head = rows[0].map((h) => h.trim());
  const lines: string[] = [];
  for (const r of rows.slice(1)) {
    const parts = head
      .map((h, i) => ({ h, v: (r[i] || '').trim() }))
      .filter((x) => x.v && !LINKEDIN_SKIP_COLUMNS.test(x.h))
      .map((x) => `${x.h}: ${x.v}`);
    if (parts.length) lines.push(`- ${parts.join(' | ')}`);
  }
  return lines.length ? `## LinkedIn: ${label}\n${lines.join('\n')}` : '';
}

// ---------- Facebook ----------

// Facebook writes UTF-8 text as if it were Latin-1, so accents and emoji look broken until this is undone
function fixFacebookText(s: string): string {
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}

// Path parts that are worth reading. Messages, friends, ads, security, location and search history are not here.
const FACEBOOK_PATHS = /(profile_information|your_posts|posts\/|comments|pages|reviews|recommendations|events|professional|about_you|groups_you|work|education)/i;
const FACEBOOK_NEVER = /(messages|inbox|friends|ads|security|login|location|search_history|off-facebook|apps_and_websites|payment|contacts|following_and_followers)/i;
const FB_TEXT_KEYS = new Set(['post', 'comment', 'title', 'description', 'text', 'name', 'full_name', 'about_me', 'bio', 'headline', 'company_name', 'employer', 'organization', 'position', 'school_name', 'school', 'institution', 'degree', 'city', 'current_city', 'hometown', 'review_text']);
// Captions Facebook adds to every item carry no information about the person
const FB_FILLER = /^(commented on|posted on|updated|shared|liked|reacted|added|changed|wrote on|replied to)\b/i;

function collectFacebookJson(value: unknown, out: string[], depth = 0): void {
  if (depth > 12 || out.length > 4000) return;
  if (Array.isArray(value)) { value.forEach((v) => collectFacebookJson(v, out, depth + 1)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && FB_TEXT_KEYS.has(k) && v.trim().length > 2) { const t = fixFacebookText(v.trim()); if (!FB_FILLER.test(t)) out.push(t); }
      else if (typeof v === 'number' && k === 'timestamp') continue;
      else collectFacebookJson(v, out, depth + 1);
    }
  }
}

function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|li|h\d|tr|br)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

// ---------- Entry point ----------

const baseName = (path: string) => path.split('/').pop()!.toLowerCase();

export async function importProfileFiles(platform: ImportPlatform, files: File[]): Promise<ImportResult> {
  // Gather every file as { path, bytes }, opening zip archives
  const entries: { path: string; bytes: Uint8Array }[] = [];
  for (const f of files) {
    const buf = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) {
      const unzipped = unzipSync(buf);
      for (const [path, bytes] of Object.entries(unzipped)) if (bytes.length) entries.push({ path, bytes });
    } else {
      entries.push({ path: f.name, bytes: buf });
    }
  }

  const sections: string[] = [];
  const filesRead: string[] = [];
  let skipped = 0;

  for (const { path, bytes } of entries) {
    const name = baseName(path);
    if (platform === 'LinkedIn') {
      const match = LINKEDIN_FILES.find(([re]) => re.test(name));
      if (match && name.endsWith('.csv')) {
        const text = linkedinFileToText(match[1], strFromU8(bytes));
        if (text) { sections.push(text); filesRead.push(path); } else skipped++;
      } else if (/(^|\/)articles\/.*\.html?$/i.test(path)) {
        const text = htmlToText(strFromU8(bytes)).slice(0, 6000);
        if (text) { sections.push(`## LinkedIn: Article ${name}\n${text}`); filesRead.push(path); }
      } else skipped++;
    } else {
      if (FACEBOOK_NEVER.test(path) || !FACEBOOK_PATHS.test(path)) { skipped++; continue; }
      if (name.endsWith('.json')) {
        let data: unknown;
        try { data = JSON.parse(strFromU8(bytes)); } catch { skipped++; continue; }
        const out: string[] = [];
        collectFacebookJson(data, out);
        const uniq = [...new Set(out)];
        if (uniq.length) { sections.push(`## Facebook: ${path.replace(/\.json$/i, '')}\n${uniq.map((u) => `- ${u}`).join('\n')}`); filesRead.push(path); }
      } else if (/\.html?$/i.test(name)) {
        const text = htmlToText(strFromU8(bytes)).slice(0, 12_000);
        if (text.length > 20) { sections.push(`## Facebook: ${path.replace(/\.html?$/i, '')}\n${text}`); filesRead.push(path); }
      } else skipped++;
    }
  }

  let text = sections.join('\n\n');
  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);
  return { text, filesRead, filesSkipped: skipped, truncated };
}
