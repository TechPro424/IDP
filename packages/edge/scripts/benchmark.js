const { BloomFilter } = require('./bloomFilter');

// Simple KV stub
class InMemoryKV {
  constructor() { this.store = new Map(); }
  async get(k){ return this.store.get(k); }
  async put(k,v){ this.store.set(k,v); }
  async delete(k){ this.store.delete(k); }
}

async function benchmark(){
  const bloom = new BloomFilter();
  const kv = new InMemoryKV();
  const prefixes = Array.from({length:10000},(_,i)=>`prefix-${i}`);

  console.time('BloomAdd');
  for(const p of prefixes){ bloom.add(p); }
  console.timeEnd('BloomAdd');

  console.time('BloomTest');
  for(const p of prefixes){ bloom.test(p); }
  console.timeEnd('BloomTest');

  console.time('KVPut');
  for(const p of prefixes){ await kv.put(p,'true'); }
  console.timeEnd('KVPut');

  console.time('KVGet');
  for(const p of prefixes){ await kv.get(p); }
  console.timeEnd('KVGet');
}

benchmark();
