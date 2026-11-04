import { extractFeatures, AudioInput } from '../src/index.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Simple benchmark: read a sample WAV (mono 16k) and run feature extraction
const samplePath = fileURLToPath(new URL('../tests/sample.wav', import.meta.url));
if (!fs.existsSync(samplePath)) {
  console.warn('Sample WAV not found, skipping benchmark');
  process.exit(0);
}
const buffer = fs.readFileSync(samplePath);
// Convert to Float32Array assuming 16-bit PCM
const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
const float32 = new Float32Array(samples.length);
for (let i = 0; i < samples.length; i++) {
  float32[i] = samples[i] / 32768;
}
const input: AudioInput = { data: float32, sampleRate: 16000 };
console.time('extractFeatures');
const result = extractFeatures(input);
console.timeEnd('extractFeatures');
console.log('Result', JSON.stringify(result, null, 2));
