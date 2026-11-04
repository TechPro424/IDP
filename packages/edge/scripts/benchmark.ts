import { BloomFilter } from '../bloomFilter.js';

// Simple KV stub
class InMemoryKV {
  private store: Map<string, string>;
  constructor() {
    this.store = new Map();
  }
  async get(k: string): Promise<string | undefined> {
    return this.store.get(k);
  }
  async put(k: string, v: string): Promise<void> {
    this.store.set(k, v);
  }
  async delete(k: string): Promise<void> {
    this.store.delete(k);
  }
}

async function benchmark(): Promise<void> {
  const bloom = new BloomFilter();
  const kv = new InMemoryKV();
  const prefixes = Array.from({ length: 10000 }, (_, i) => `prefix-${i}`);

  console.time('BloomAdd');
  for (const p of prefixes) {
    bloom.add(p);
  }
  console.timeEnd('BloomAdd');

  console.time('BloomTest');
  for (const p of prefixes) {
    bloom.test(p);
  }
  console.timeEnd('BloomTest');

  console.time('KVPut');
  for (const p of prefixes) {
    await kv.put(p, 'true');
  }
  console.timeEnd('KVPut');

  console.time('KVGet');
  for (const p of prefixes) {
    await kv.get(p);
  }
  console.timeEnd('KVGet');
}

benchmark();
