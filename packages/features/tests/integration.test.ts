import { extractFeatures, AudioInput, VisualAnalyzer, extractTextFeatures } from '../src/index';

// Create dummy audio data
const sampleRate = 48000;
const durationSec = 1;
const freq = 440;
const data = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < data.length; i++) {
  data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5;
}
const input: AudioInput = { data, sampleRate };

// Dummy image data
const imageData = {
  width: 640,
  height: 360,
  data: new Uint8ClampedArray(640 * 360 * 4),
};

const text = 'Hello world! Hello again. Test test test.';

const result = extractFeatures(input, imageData, text);
console.log('Integration result:', result);
if (!result.audio) throw new Error('Missing audio');
if (!result.visual) throw new Error('Missing visual');
if (!result.text) throw new Error('Missing text');
console.log('Integration test passed.');
