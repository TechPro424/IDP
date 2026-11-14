// Browser-vs-Node feature parity (plan §7.1).
//
// The library is written once and runs in both places; this asserts the two
// builds agree on real audio. Node side = scripts/cli.ts (what the training
// pipeline uses). Browser side = the same source bundled by Vite and executed
// in Chromium with WebAudio decoding the identical WAV bytes.
//
// Playwright needs *some* Chromium; the headless shell is enough here because
// no extension is loaded.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(pkgRoot, '../..');
const BUNDLE = path.join(pkgRoot, '.parity/features.iife.js');
const WAV = path.join(pkgRoot, '.parity/parity.wav');

/** 16-bit mono 48 kHz: tone, silence, noise, tone — exercises every audio feature. */
function writeWav(file: string, sampleRate = 48000): void {
  const total = Math.round(sampleRate * 2);
  const pcm = new Int16Array(total);
  let seed = 12345;
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    let v = 0;
    if (t < 0.6) v = 0.35 * Math.sin(2 * Math.PI * 220 * t);
    else if (t < 0.8) v = 0;
    else if (t < 1.2) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      v = 0.3 * ((seed / 0x7fffffff) * 2 - 1);
    } else v = 0.3 * Math.sin(2 * Math.PI * 440 * t);
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  const data = Buffer.from(pcm.buffer);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

function nodeFeatures(wav: string): Record<string, unknown> {
  const out = execFileSync(
    'node',
    ['--no-warnings', '--loader', 'ts-node/esm', 'scripts/cli.ts', wav],
    { cwd: pkgRoot, encoding: 'utf8' },
  );
  return JSON.parse(out).audio;
}

function closeEnough(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    // relative for normal values, absolute floor for dB figures: both sides take
    // log of a near-silent percentile, which amplifies float noise ~1e5x
    return Math.abs(a - b) <= 1e-3 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));
  }
  return a === b;
}

test.beforeAll(() => {
  if (!fs.existsSync(BUNDLE)) {
    execFileSync('node', ['scripts/build-parity-bundle.mjs'], { cwd: pkgRoot, stdio: 'inherit' });
  }
  fs.mkdirSync(path.join(pkgRoot, '.parity'), { recursive: true });
  writeWav(WAV);
});

test('browser build and Node CLI agree on the audio feature vector', async ({ page }) => {
  const expected = nodeFeatures(WAV);
  const bytes = fs.readFileSync(WAV).toString('base64');

  await page.goto('about:blank');
  await page.addScriptTag({ path: BUNDLE });

  const actual = await page.evaluate(async (payload: string) => {
    const binary = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    // OfflineAudioContext at the file's own rate: no resampling on either side
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const buffer = await ctx.decodeAudioData(binary.buffer);
    const lib = (window as any).SlopFeatures;
    const result = await lib.extractFeatures({
      data: buffer.getChannelData(0),
      sampleRate: buffer.sampleRate,
      targetSampleRate: 48000,
    });
    // JSON round-trip so NaN/undefined normalise the way the training pipeline
    // serialises them (the CLI prints JSON, where NaN becomes null)
    return JSON.parse(JSON.stringify(result.audio));
  }, bytes);

  expect(actual).toBeTruthy();
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const key of Object.keys(expected)) {
    if (!closeEnough(actual[key], expected[key])) {
      throw new Error(`feature ${key}: browser ${actual[key]} vs node ${expected[key]}`);
    }
  }
  // sanity: the fixture is not silent, so the numbers are not all zero
  expect(expected.speechRatio).toBeGreaterThan(0);
  expect(expected.avgPitch).toBeGreaterThan(150);
});