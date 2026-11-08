// Build the model's training/validation CSV from a labelled manifest.
// Usage:
//   node --loader ts-node/esm packages/scripts/build-training-set.ts \
//     --manifest packages/data/processed/manifest.csv \
//     --out-dir packages/data/processed [--split 0.8] [--seed 1337]
//
// Manifest columns: file,label[,captions]
//   file     path to a WAV (relative to the manifest's directory)
//   label    1 = synthetic narration, 0 = human
//   captions optional path to a .txt transcript/caption dump
// Output: <out-dir>/train.csv and <out-dir>/val.csv with columns label,S,H.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { extractFeatures } from '../features/src/index.js';
import { config } from '../features/src/config.js';
import { readWav } from '../features/scripts/wav.js';
import { deriveSubScores } from '../scoring/src/proxies.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value === undefined && fallback === undefined) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return value ?? fallback!;
}

/** Deterministic shuffle so the split is reproducible from the seed alone. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const manifestPath = arg('manifest');
const outDir = arg('out-dir', 'packages/data/processed');
const split = Number(arg('split', '0.8'));
const seed = Number(arg('seed', '1337'));
const base = dirname(resolve(manifestPath));

if (!existsSync(manifestPath)) {
  console.error(`error: no manifest at ${manifestPath} - see SETUP.md`);
  process.exit(1);
}

const rows = readFileSync(manifestPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const header = rows.shift()?.split(',') ?? [];
if (header[0] !== 'file' || header[1] !== 'label') {
  console.error('error: manifest header must start with "file,label"');
  process.exit(1);
}

const out: string[] = [];
let skipped = 0;
for (const row of rows) {
  const [file, labelRaw, captions] = row.split(',');
  const label = Number(labelRaw);
  if (label !== 0 && label !== 1) {
    console.error(`error: label must be 0 or 1, got "${labelRaw}" for ${file}`);
    process.exit(1);
  }
  try {
    if (!captions) {
      // H is a mean of Hatt/Hsub; with no frames the only source is the transcript.
      skipped++;
      console.error(`warn: ${file} has no captions - H needs a transcript, skipped`);
      continue;
    }
    const wav = readWav(resolve(base, file));
    const text = readFileSync(resolve(base, captions), 'utf8');
    const features = await extractFeatures({ ...wav, targetSampleRate: config.audio.labSampleRate }, undefined, text);
    const sub = deriveSubScores(features);
    // ponytail: no frames in the corpus -> H falls back to the text proxy only.
    // Documented in SETUP.md; add frame sampling if Hatt turns out to matter.
    const H = sub.Hatt != null && sub.Hsub != null ? (sub.Hatt + sub.Hsub) / 2 : (sub.Hsub ?? sub.Hatt);
    if (sub.S === undefined || H === undefined) {
      skipped++;
      console.error(`warn: ${file} produced no audio/text features - skipped`);
      continue;
    }
    out.push(`${label},${sub.S.toFixed(6)},${H.toFixed(6)}`);
  } catch (err) {
    skipped++;
    console.error(`warn: ${file}: ${(err as Error).message} - skipped`);
  }
}

if (out.length < 20) {
  console.error(`error: only ${out.length} usable rows; need at least 20 (plan wants >= 250)`);
  process.exit(1);
}

const rand = mulberry32(seed);
const shuffled = out
  .map((line) => ({ line, key: rand() }))
  .sort((a, b) => a.key - b.key)
  .map((x) => x.line);
const cut = Math.max(1, Math.floor(shuffled.length * split));

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/train.csv`, `label,S,H\n${shuffled.slice(0, cut).join('\n')}\n`);
writeFileSync(`${outDir}/val.csv`, `label,S,H\n${shuffled.slice(cut).join('\n')}\n`);
console.error(`wrote ${cut} train / ${shuffled.length - cut} val rows (${skipped} skipped) to ${outDir}`);