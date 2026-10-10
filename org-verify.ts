// Checks the pages the AI cites for each organization: the page must actually mention the organization.
import * as cheerio from 'cheerio';
import { safeFetchText } from './safe-fetch';

export interface OrgCheckLike {
  organization: string;
  status?: string;
  sourceUrl?: string;
  whatWeFound?: string;
  linkChecked?: 'mentions' | 'does-not-mention' | 'could-not-open';
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['the', 'of', 'and', 'for', 'inc', 'ltd', 'university', 'college', 'school', 'board', 'association', 'institute', 'centre', 'center', 'foundation', 'organization', 'organisation', 'in', 'at']);

// The distinctive words of an organization name (acronyms inside brackets count too)
function keyWords(org: string): string[] {
  const words = norm(org.replace(/\(([^)]*)\)/g, ' $1 ')).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)];
}

export async function verifyOrganizationChecks<T extends OrgCheckLike>(items: T[], knownText: (url: string) => string | undefined): Promise<T[]> {
  const out: T[] = [];
  let next = 0;
  const work = async () => {
    while (next < items.length) {
      const i = next++;
      const o = { ...items[i] };
      out[i] = o;
      if (!o.sourceUrl || !/^https?:\/\//.test(o.sourceUrl)) continue;
      let text = knownText(o.sourceUrl);
      if (!text) {
        const page = await safeFetchText(o.sourceUrl, { timeoutMs: 8000, maxBytes: 600_000 });
        if (page) text = cheerio.load(page.text).root().text();
      }
      if (!text) {
        o.linkChecked = 'could-not-open';
        if ((o.status || '').toLowerCase().startsWith('confirmed')) o.whatWeFound = `${o.whatWeFound || ''} (We could not open the linked page to check it.)`.trim();
        continue;
      }
      const hay = norm(text);
      const words = keyWords(o.organization);
      const hits = words.filter((w) => hay.includes(w)).length;
      // Most distinctive words (at least half, and at least one) must appear on the page
      const mentions = words.length > 0 && hits >= Math.max(1, Math.ceil(words.length / 2));
      o.linkChecked = mentions ? 'mentions' : 'does-not-mention';
      if (!mentions && (o.status || '').toLowerCase().startsWith('confirmed')) {
        o.status = 'partly confirmed';
        o.whatWeFound = `${o.whatWeFound || ''} (Checked: the linked page does not mention this organization, so this is not fully confirmed.)`.trim();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, work));
  return out;
}
