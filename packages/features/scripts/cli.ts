import { readFileSync } from 'fs';
import { join } from 'path';
import { extractFeatures, AudioInput } from '../src/index';

// Simple CLI: node cli.ts <path-to-wav>
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: ts-node packages/features/scripts/cli.ts <wav-file>');
  process.exit(1);
}
const wavPath = args[0];
const buffer = readFileSync(wavPath);
// Assume 16-bit PCM WAV, mono. Convert to Float32Array.
const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
const float32 = new Float32Array(samples.length);
for (let i = 0; i < samples.length; i++) {
  float32[i] = samples[i] / 32768;
}
const input: AudioInput = { data: float32, sampleRate: 16000 };
const result = extractFeatures(input);
console.log(JSON.stringify(result, null, 2));
