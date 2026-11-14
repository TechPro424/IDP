// Node-only: extract the feature vector for one video's audio (+ optional captions).
// Usage: node --loader ts-node/esm packages/features/scripts/cli.ts <wav> [captions.txt]
import { readFileSync } from 'node:fs';
import { extractFeatures } from '../src/index.js';
import { config } from '../src/config.js';
import { readWav } from './wav.js';

const [wavPath, captionPath] = process.argv.slice(2);
if (!wavPath) {
  console.error('Usage: cli.ts <wav-file> [captions.txt]');
  process.exit(1);
}

const wav = readWav(wavPath);
const captions = captionPath ? readFileSync(captionPath, 'utf8') : undefined;
// Lab audio is resampled to the shared lab rate so Node and the browser agree.
const features = await extractFeatures({ ...wav, targetSampleRate: config.audio.labSampleRate }, undefined, captions);
console.log(JSON.stringify(features, null, 2));