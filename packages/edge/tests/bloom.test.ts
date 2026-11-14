import { BloomFilter, optimalParameters } from '../bloomFilter.js';

(() => {
  const filter = new BloomFilter({ expectedItems: 1000, falsePositiveRate: 0.001 });

  // k ~= (m/n) ln2 should be around 10 for p=0.001.
  const { bits, hashes } = optimalParameters(1000, 0.001);
  if (hashes < 8 || hashes > 12) throw new Error(`unexpected hash count ${hashes}`);
  if (bits < 14_000 || bits > 15_000) throw new Error(`unexpected bit count ${bits}`);

  // No false negatives.
  const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`);
  for (const k of keys) filter.add(k);
  for (const k of keys) if (!filter.test(k)) throw new Error(`false negative for ${k}`);

  // Observed FPR near the target (allow generous slack for 1000 trials).
  let fp = 0;
  const trials = 5000;
  for (let i = 0; i < trials; i++) if (filter.test(`absent-${i}`)) fp++;
  const observed = fp / trials;
  console.log(`Bloom FPR target 0.001, observed ${observed.toFixed(4)} (est ${filter.estimateFpr(keys.length).toFixed(4)})`);
  if (observed > 0.01) throw new Error(`FPR too high: ${observed}`);

  // Binary round-trip preserves membership.
  const restored = BloomFilter.fromBinary(filter.toBinary());
  if (!restored.test('key-500')) throw new Error('Restored filter missing key');
  if (restored.sizeBits !== filter.sizeBits || restored.hashCount !== filter.hashCount) {
    throw new Error('Restored filter parameters differ');
  }

  console.log('Bloom filter test passed.');
})();
