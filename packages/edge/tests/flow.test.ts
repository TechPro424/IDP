// End-to-end contract test for the publish path: what publish-bloom.ts writes
// into KV must be exactly what the Worker serves and what the client can use.
// Unit tests cover the pieces; this covers the seam between them.
import { createApp, type Env, type KVStore } from '../handler.js';
import { bloomKey, bucketKey, emptyBucket, padBucket, BUCKET_PAD, PREFIX_LENGTH, SUFFIX_LENGTH } from '../keys.js';
import { BloomFilter } from '../bloomFilter.js';

let failures = 0;
function check(name: string, fn: () => boolean): void {
  let ok = false;
  try {
    ok = fn();
  } catch (e) {
    console.error(`  ${name}: threw ${(e as Error).message}`);
  }
  if (!ok) {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

class MockKV implements KVStore {
  store = new Map<string, ArrayBuffer | string>();
  async get(key: string, type?: 'text' | 'arrayBuffer'): Promise<any> {
    const value = this.store.get(key);
    if (value === undefined) return null;
    return type === 'arrayBuffer' ? value : typeof value === 'string' ? value : new TextDecoder().decode(value);
  }
  async put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void> {
    this.store.set(key, typeof value === 'string' ? value : (value as ArrayBuffer));
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Two buckets, as publish-bloom.ts would build them.
const known = [
  { prefix: 'a1b2c', suffix: 'd3e4f5a6b7c' },
  { prefix: 'a1b2c', suffix: '1122334455a' },
  { prefix: '99887', suffix: '6655443322a' },
];
const VERSION = 'model-1';

const kv = new MockKV();
const filter = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.001 });
for (const { prefix, suffix } of known) filter.add(`${prefix}${suffix}`);
await kv.put(bloomKey(VERSION), filter.toBinary().buffer as ArrayBuffer);

const byPrefix = new Map<string, { s: string; d: 1 | 2; c: number }[]>();
for (const { prefix, suffix } of known) {
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix)!.push({ s: suffix, d: 2, c: 100 });
}
for (const [prefix, entries] of byPrefix) {
  const bucket = emptyBucket(VERSION);
  bucket.entries = entries;
  padBucket(bucket);
  await kv.put(bucketKey(prefix), JSON.stringify(bucket));
}

const env: Env = { KV: kv, BLOOM_VERSION: VERSION, BLOOM_EXPECTED_ITEMS: '1000', BLOOM_FPR: '0.001' };
const app = createApp();

// 1. The published blob is served back byte-identical and parses client-side.
const bloomRes = await app.request('/v1/bloom/latest', {}, env);
const bloomBody = await bloomRes.arrayBuffer();
check('bloom: 200', () => bloomRes.status === 200);
check('bloom: version header', () => bloomRes.headers.get('X-Bloom-Version') === VERSION);
check('bloom: content type', () => bloomRes.headers.get('Content-Type') === 'application/octet-stream');
check('bloom: byte-identical', () => new Uint8Array(bloomBody).join() === new Uint8Array(filter.toBinary()).join());

const served = BloomFilter.fromBinary(bloomBody);
check('bloom: known entry hits', () => served.test('a1b2cd3e4f5a6b7c'));
check('bloom: unknown entry misses', () => !served.test('a1b2c0000000000a'));

// 2. Bucket records survive the round trip.
const bucketRes = await app.request('/v1/bucket/a1b2c', {}, env);
const bucket = await bucketRes.json();
check('bucket: 200', () => bucketRes.status === 200);
check('bucket: real entries preserved', () => bucket.entries.filter((e: any) => e.s === 'd3e4f5a6b7c').length === 1
  && bucket.entries.filter((e: any) => e.s === '1122334455a').length === 1);
check('bucket: decoys keep entries absent', () => !bucket.entries.some((e: any) => e.s === '00000000000'));
check('bucket: padded to fixed size', () => bucket.entries.length === BUCKET_PAD);
check('bucket: pad flag', () => bucket.pad === true);
check('bucket: prefix/suffix lengths', () => bucket.p === PREFIX_LENGTH && bucket.q === SUFFIX_LENGTH);
check('bucket: entries carry a verdict + score', () => bucket.entries.every((e: any) => (e.d === 1 || e.d === 2) && e.c >= 0 && e.c <= 100));
check('bucket: schema version', () => bucket.v === 1);
check('bucket: model version', () => bucket.mv === VERSION);
check('bucket: header hides origin', () => bucketRes.headers.get('Access-Control-Allow-Origin') === '*');

// 3. A version bump serves an empty filter instead of the stale one.
const empty = createApp();
const bumped = await empty.request('/v1/bloom/latest', {}, { ...env, BLOOM_VERSION: 'model-2' });
const bumpedBody = await bumped.arrayBuffer();
check('bloom: version bump header', () => bumped.headers.get('X-Bloom-Version') === 'model-2');
check('bloom: version bump is empty', () => !BloomFilter.fromBinary(bumpedBody).test('a1b2cd3e4f5a6b7c'));

// 4. CORS preflight (the extension fetches cross-origin).
const preflight = await app.request('/v1/bucket/a1b2c', { method: 'OPTIONS' }, env);
check('cors: preflight 204', () => preflight.status === 204);

if (failures) {
  console.error(`${failures} publish-flow check(s) failed`);
  process.exit(1);
}
console.log('Publish flow tests passed');