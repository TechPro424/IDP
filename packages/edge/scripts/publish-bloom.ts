// Build the Bloom pre-filter blob and the KV bucket records from a URL list.
// Usage:
//   node --loader ts-node/esm packages/edge/scripts/publish-bloom.ts \
//     --urls known-slop.txt --version model-1 --out dist
//
// known-slop.txt: one video URL per line (blank lines and # comments ignored).
// Writes <out>/bloom-<version>.bin and <out>/upload-kv.sh (review before running).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BloomFilter } from '../../bloom/src/index.js';
import { hashVideoUrl } from '../../features/src/hash.js';
import { bloomKey, bucketKey, emptyBucket, padBucket } from '../keys.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value === undefined && fallback === undefined) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return value ?? fallback!;
}

const urlsPath = arg('urls');
const version = arg('version', 'model-1');
const outDir = arg('out', 'dist');
const fpr = Number(arg('fpr', '0.001'));

const urls = readFileSync(urlsPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (urls.length < 10) {
  console.error(`error: ${urls.length} URLs; refusing to publish a filter this small (defeats the k-anonymity padding)`);
  process.exit(1);
}

const buckets = new Map<string, Set<string>>();
for (const url of urls) {
  const { prefix, suffix } = await hashVideoUrl(url);
  if (!buckets.has(prefix)) buckets.set(prefix, new Set());
  buckets.get(prefix)!.add(suffix);
}

mkdirSync(outDir, { recursive: true });

const filter = new BloomFilter({ expectedItems: Math.max(urls.length, 1000), falsePositiveRate: fpr });
for (const [prefix, suffixes] of buckets) for (const suffix of suffixes) filter.add(`${prefix}${suffix}`);
const blobPath = `${outDir}/bloom-${version}.bin`;
writeFileSync(blobPath, Buffer.from(filter.toBinary()));

const lines: string[] = ['#!/usr/bin/env bash', 'set -euo pipefail', '# Review before running: writes to the *remote* KV namespace.', ''];
lines.push(`wrangler kv key put --binding KV --remote "${bloomKey(version)}" --path "${blobPath}"`);
for (const [prefix, suffixes] of buckets) {
  const bucket = emptyBucket(version);
  // Seeded entries are REVIEW (d = 2): the client's ceiling is ALLOW -> REVIEW,
  // so the edge can never force a block on its own (docs/adr/007-strategy.md).
  bucket.entries = [...suffixes].map((s) => ({ s, d: 2 as const, c: 100 }));
  padBucket(bucket);
  const tmp = `${outDir}/bucket-${prefix}.json`;
  writeFileSync(tmp, JSON.stringify(bucket));
  lines.push(`wrangler kv key put --binding KV --remote "${bucketKey(prefix)}" --path "${tmp}"`);
}
lines.push('');
const scriptPath = `${outDir}/upload-kv.sh`;
writeFileSync(scriptPath, lines.join('\n'), { mode: 0o755 });

console.log(`${urls.length} URLs -> ${buckets.size} buckets`);
console.log(`bloom: ${blobPath} (${(filter.toBinary().byteLength / 1024).toFixed(1)} kB, fpr target ${fpr})`);
console.log(`next: review ${scriptPath}, then set BLOOM_VERSION="${version}" in packages/edge/wrangler.toml`);