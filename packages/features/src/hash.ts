// SHA-256 hashing + prefix/suffix split. Browser-safe (WebCrypto).
import { config } from './config.js';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i]];
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export interface UrlHash {
  /** Sent to the edge (server-side bucket key). */
  prefix: string;
  /** Kept client-side to disambiguate Bloom false positives. */
  suffix: string;
  full: string;
}

/**
 * Hash a video URL into a server prefix and a client-only suffix.
 *
 * Plan §7.3 hashes the *video id*, so a Short and its watch page land in the
 * same bucket. Non-YouTube URLs (fixtures, tests) fall back to the canonical
 * URL, which still drops volatile query params.
 */
export async function hashVideoUrl(url: string): Promise<UrlHash> {
  const full = await sha256Hex(videoIdOf(url) ?? canonicalizeUrl(url));
  const { prefixLength: p, suffixLength: q } = config.hashing;
  return {
    prefix: full.slice(0, p),
    suffix: full.slice(p, p + q),
    full,
  };
}

/** YouTube video id for a watch (`?v=`) or Shorts URL, else null. */
export function videoIdOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith('youtube.com')) return null;
    const v = u.searchParams.get('v');
    if (v) return v;
    const shorts = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
    return shorts ? shorts[1] : null;
  } catch {
    return null;
  }
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.endsWith('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/watch?v=${id}`;
      const shorts = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
      if (shorts) return `https://www.youtube.com/shorts/${shorts[1]}`;
    }
    return u.origin + u.pathname;
  } catch {
    return rawUrl;
  }
}
