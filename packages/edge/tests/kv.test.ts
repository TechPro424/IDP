import { createApp, type KVStore, type Env } from '../handler.js';
import { BloomFilter } from '../bloomFilter.js';
import { BUCKET_PAD, bloomKey, bucketKey, emptyBucket } from '../keys.js';

function mockKV() {
  const store = new Map<string, any>();
  const kv: KVStore = {
    async get(key) { return store.get(key); },
    async put(key, value, _options) { store.set(key, value); },
    async delete(key) { store.delete(key); },
  };
  return { kv, store };
}

const app = createApp();

(async () => {
  const { kv, store } = mockKV();
  const env: Env = { KV: kv, BLOOM_VERSION: 'kv-test' };
  const suffix = 'fffffffffff';

  // The publisher writes the bucket and the Bloom blob straight to KV; the
  // worker only ever reads them.
  const bucket = emptyBucket('kv-test');
  bucket.entries = [{ s: suffix, d: 2, c: 100 }];
  store.set(bucketKey('abcdef01'), JSON.stringify(bucket));
  const filter = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.001 });
  filter.add(`abcdef01${suffix}`);
  store.set(bloomKey('kv-test'), filter.toBinary());

  const res = await app.request('/v1/bucket/abcdef01', {}, env);
  const body = await res.json();
  if (body.entries.length !== BUCKET_PAD) throw new Error(`KV bucket not padded: ${body.entries.length}`);
  if (!body.entries.some((e: any) => e.s === suffix && e.d === 2)) throw new Error('KV did not persist the suffix');

  // Bloom blob round-trips through binary serialisation.
  const bloomRes = await app.request('/v1/bloom/latest', {}, env);
  const served = BloomFilter.fromBinary(new Uint8Array(await bloomRes.arrayBuffer()));
  if (!served.test(`abcdef01${suffix}`)) throw new Error('Bloom blob missing inserted key');

  console.log('KV integration test passed');
})();
