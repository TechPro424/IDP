// Client for the optional edge corroboration service.
// Only a 5-hex-char prefix (and later a suffix for the exact check) ever leaves
// the device — never the full URL or the video id.
import { BloomFilter } from '../bloom/src/index.js';
import { hashVideoUrl } from '../features/src/hash.js';

export interface EdgeBucketEntry {
  /** Suffix hex (or a decoy of the same length). */
  s: string;
  /** 1 = BLOCK, 2 = REVIEW (decoys carry a random value). */
  d: 1 | 2;
  /** Quantized SRS 0-100. */
  c: number;
}

export interface EdgeBucket {
  v: number;
  mv: string;
  p: number; // prefix length
  q: number; // suffix length
  entries: EdgeBucketEntry[];
  pad: true;
}

let bloomCache: { version: string; filter: BloomFilter } | null = null;
let bloomMissAt = 0;
const BLOOM_RETRY_MS = 10 * 60 * 1000;

const normalize = (origin: string) => origin.replace(/\/+$/, '');

/** Fetch and cache the versioned Bloom filter. Returns null when unavailable. */
export async function fetchBloom(origin: string): Promise<{ version: string; filter: BloomFilter } | null> {
  if (!origin) return null;
  if (bloomMissAt && Date.now() - bloomMissAt < BLOOM_RETRY_MS) return bloomCache;
  try {
    const res = await fetch(`${normalize(origin)}/v1/bloom/latest`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) {
      bloomMissAt = Date.now();
      return bloomCache;
    }
    const version = res.headers.get('X-Bloom-Version') ?? 'unknown';
    if (bloomCache && bloomCache.version === version) return bloomCache;
    const filter = BloomFilter.fromBinary(await res.arrayBuffer());
    bloomCache = { version, filter };
    bloomMissAt = 0;
    return bloomCache;
  } catch {
    bloomMissAt = Date.now();
    return bloomCache;
  }
}

/** Fetch the padded bucket for a prefix. */
export async function fetchBucket(origin: string, prefix: string): Promise<EdgeBucket | null> {
  if (!origin) return null;
  try {
    const res = await fetch(`${normalize(origin)}/v1/bucket/${prefix}`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return null;
    return (await res.json()) as EdgeBucket;
  } catch {
    return null;
  }
}

/** Confirm an exact membership match (the bucket is padded with decoys). */
export function bucketContains(bucket: EdgeBucket | null, suffix: string): boolean {
  return !!bucket?.entries?.some((e) => e.s === suffix);
}

export async function lookupUrl(
  origin: string,
  url: string,
): Promise<{ known: boolean; version: string; verdict?: 1 | 2 } | null> {
  if (!origin) return null;
  const { prefix, suffix } = await hashVideoUrl(url);
  const bloom = await fetchBloom(origin);
  if (bloom && !bloom.filter.test(`${prefix}${suffix}`)) {
    return { known: false, version: bloom.version };
  }
  const bucket = await fetchBucket(origin, prefix);
  if (!bucket) return bloom ? { known: false, version: bloom.version } : null;
  const hit = bucket.entries?.find((e) => e.s === suffix);
  return { known: !!hit, version: bucket.mv, verdict: hit?.d };
}
