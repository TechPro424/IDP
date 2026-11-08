// KV key + record shapes shared by the Worker and the offline publisher, so the
// two cannot drift (a mismatch would mean every lookup silently misses).
// The record shape is the plan's §7.3 bucket schema.

/** Bump when the on-KV bucket schema changes. */
export const BUCKET_SCHEMA_VERSION = 1;

/** Every response carries exactly this many entries (real ones + decoys). */
export const BUCKET_PAD = 32;

/** Plan §7.3 defaults for the hex prefix/suffix split. */
export const PREFIX_LENGTH = 5;
export const SUFFIX_LENGTH = 11;

export const bloomKey = (version: string): string => `bloom:${version}`;

export const bucketKey = (prefix: string): string => `bucket:${prefix}`;

export interface BucketEntry {
  /** Suffix hex (client-held; never sent in the request) or a decoy. */
  s: string;
  /** 1 = BLOCK, 2 = REVIEW. Decoys carry a random value. */
  d: 1 | 2;
  /** Quantized SRS, 0-100. Decoys carry a random value. */
  c: number;
}

export interface Bucket {
  v: number; // schema version
  mv: string; // model / verdict-set version
  p: number; // prefix length in hex chars
  q: number; // suffix length in hex chars
  entries: BucketEntry[];
  pad: true; // always true: entries are padded to BUCKET_PAD
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out.slice(0, n);
}

/**
 * Grow a bucket to exactly BUCKET_PAD entries with decoys and shuffle them, so
 * neither the count nor the position of real entries leaks. Idempotent.
 */
export function padBucket(bucket: Bucket): Bucket {
  const taken = new Set(bucket.entries.map((e) => e.s));
  while (bucket.entries.length < BUCKET_PAD) {
    const s = randomHex(bucket.q);
    if (taken.has(s)) continue;
    taken.add(s);
    bucket.entries.push({ s, d: Math.random() < 0.5 ? 1 : 2, c: Math.floor(Math.random() * 101) });
  }
  for (let i = bucket.entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bucket.entries[i], bucket.entries[j]] = [bucket.entries[j], bucket.entries[i]];
  }
  bucket.pad = true;
  return bucket;
}

export function emptyBucket(modelVersion: string, suffixLength: number = SUFFIX_LENGTH): Bucket {
  return {
    v: BUCKET_SCHEMA_VERSION,
    mv: modelVersion,
    p: PREFIX_LENGTH,
    q: suffixLength,
    entries: [],
    pad: true,
  };
}
