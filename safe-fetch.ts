import dns from 'node:dns/promises';
import net from 'node:net';

// Block server-side requests to private/internal addresses (SSRF protection)
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
}

export async function assertPublicUrl(raw: string): Promise<void> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('URL resolves to a private address');
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Fetches a public page as text: checks every redirect hop, limits time and size.
export async function safeFetchText(url: string, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<{ finalUrl: string; text: string; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    let current = url;
    let resp: Response;
    for (let hop = 0; ; hop++) {
      await assertPublicUrl(current);
      resp = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': BROWSER_UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en-US,en;q=0.9' },
      });
      const loc = resp.headers.get('location');
      if (resp.status >= 300 && resp.status < 400 && loc && hop < 4) {
        current = new URL(loc, current).toString();
        continue;
      }
      break;
    }
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) return null;
    const max = opts.maxBytes ?? 400_000;
    const reader = resp.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    return { finalUrl: current, text: Buffer.concat(chunks).toString('utf8'), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
