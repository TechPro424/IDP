import { createApp, type KVStore, type Env, type RateLimiter, BUCKET_PAD } from '../handler.js';
import { bucketKey, emptyBucket, PREFIX_LENGTH, SUFFIX_LENGTH } from '../keys.js';

// In-memory KV mock that honours the 'text' | 'arrayBuffer' read types.
function mockKV(): KVStore & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    async get(key: string, type?: string) {
      const v = store.get(key);
      if (v === undefined) return undefined;
      if (type === 'arrayBuffer') {
        if (v instanceof Uint8Array) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
        if (v instanceof ArrayBuffer) return v;
        return new TextEncoder().encode(String(v)).buffer;
      }
      if (v instanceof Uint8Array) return new TextDecoder().decode(v);
      if (v instanceof ArrayBuffer) return new TextDecoder().decode(v);
      return v;
    },
    async put(key: string, value: any) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

const app = createApp();
const env = (): Env => ({ KV: mockKV(), BLOOM_VERSION: 'test-v1' });

/** Every entry must look like a plausible verdict: no schema tells decoys apart. */
function assertEntryShape(entries: any[], q: number): void {
  for (const e of entries) {
    if (typeof e.s !== 'string' || e.s.length !== q || !/^[0-9a-f]+$/.test(e.s)) {
      throw new Error('Entry suffix malformed: ' + JSON.stringify(e));
    }
    if (e.d !== 1 && e.d !== 2) throw new Error('Entry verdict must be 1|2: ' + JSON.stringify(e));
    if (!Number.isInteger(e.c) || e.c < 0 || e.c > 100) throw new Error('Entry score out of range: ' + JSON.stringify(e));
  }
}

(async () => {
  const e = env();

  // 1. Bad prefix rejected.
  const bad = await app.request('/v1/bucket/zz!', {}, e);
  if (bad.status !== 400) throw new Error(`Expected 400 for bad prefix, got ${bad.status}`);

  // 2. An unseen prefix still returns the plan schema, padded to a fixed size.
  const emptyRes = await app.request('/v1/bucket/deadbeef', {}, e);
  const empty = await emptyRes.json();
  if (empty.v !== 1) throw new Error('Wrong schema version: ' + JSON.stringify(empty.v));
  if (empty.p !== PREFIX_LENGTH || empty.q !== SUFFIX_LENGTH) throw new Error('p/q wrong: ' + JSON.stringify(empty));
  if (empty.mv !== 'test-v1') throw new Error('Bucket missing model version');
  if (empty.pad !== true) throw new Error('pad must be true');
  if (empty.entries.length !== BUCKET_PAD) {
    throw new Error(`Empty bucket must be padded to ${BUCKET_PAD}, got ${empty.entries.length}`);
  }
  assertEntryShape(empty.entries, SUFFIX_LENGTH);

  // 3. A bucket seeded offline (as publish-bloom.ts writes it) is served padded,
  //    with the real suffix present exactly once.
  const real = 'abc123def45';
  const seeded = emptyBucket('test-v1');
  seeded.entries = [{ s: real, d: 2, c: 100 }];
  e.KV.put(bucketKey('deadbeef'), JSON.stringify(seeded));

  const gotRes = await app.request('/v1/bucket/deadbeef', {}, e);
  const got = await gotRes.json();
  if (got.entries.length !== BUCKET_PAD) throw new Error(`Padded read expected ${BUCKET_PAD}, got ${got.entries.length}`);
  const hits = got.entries.filter((x: any) => x.s === real);
  if (hits.length !== 1 || hits[0].d !== 2 || hits[0].c !== 100) {
    throw new Error('Real entry lost or altered by padding: ' + JSON.stringify(hits));
  }
  assertEntryShape(got.entries, SUFFIX_LENGTH);
  if (got.entries.filter((x: any) => x.s === real).length !== 1) throw new Error('Duplicate real entry');
  if (gotRes.headers.get('cache-control') !== 'public, max-age=3600') throw new Error('Bucket cache header wrong');

  // 4. Two reads of the same bucket must not return the same ordering
  //    (positions must not be a fingerprint).
  const order = (b: any) => b.entries.map((x: any) => x.s).join();
  const second = await (await app.request('/v1/bucket/deadbeef', {}, e)).json();
  if (order(got) === order(second)) throw new Error('Bucket ordering is stable across requests');
  if (second.entries.length !== BUCKET_PAD) throw new Error('Padded size unstable');

  // 5. There is no write route (guardrail §2.2: no contribution path).
  const post = await app.request(
    '/v1/bucket/deadbeef',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: real }) },
    e,
  );
  if (post.status < 400) throw new Error(`POST must not be accepted, got ${post.status}`);

  // 6. Rate limiting is enforced when the binding is present.
  const stubbed = (success: boolean): RateLimiter => ({ async limit() { return { success }; } });
  const limited = await app.request('/v1/bucket/deadbeef', {}, { ...env(), RATE_LIMITER: stubbed(false) });
  if (limited.status !== 429) throw new Error(`Expected 429 when over the limit, got ${limited.status}`);
  if (!limited.headers.get('retry-after')) throw new Error('429 missing Retry-After');
  const allowed = await app.request('/v1/bucket/deadbeef', {}, { ...env(), RATE_LIMITER: stubbed(true) });
  if (allowed.status !== 200) throw new Error(`Expected 200 under the limit, got ${allowed.status}`);

  // 7. Bloom blob endpoint returns BF01 binary.
  const bloomRes = await app.request('/v1/bloom/latest', {}, e);
  if (bloomRes.headers.get('content-type') !== 'application/octet-stream') throw new Error('Bloom content-type wrong');
  if (bloomRes.headers.get('x-bloom-version') !== 'test-v1') throw new Error('Bloom version header wrong');
  const bytes = new Uint8Array(await bloomRes.arrayBuffer());
  if (new DataView(bytes.buffer).getUint32(0, false) !== 0x42463031) throw new Error('Bloom magic wrong');

  console.log('Edge handler test passed');
})();
