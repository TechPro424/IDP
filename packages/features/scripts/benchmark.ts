import { extractFeatures, AudioInput } from '../src/index';
import fs from 'fs';
import path from 'path';

// Simple benchmark: read a sample WAV (mono 16k) and run feature extraction
const samplePath = path.resolve(__dirname, '..', 'tests', 'sample.wav');
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
