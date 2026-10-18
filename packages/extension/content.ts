import { extractFeatures, AudioInput } from '../features/src/index';

// Placeholder: in real extension we would capture audio from the video element
// Here we just generate a test tone and log extracted features
const sampleRate = 48000;
const durationSec = 1;
const freq = 440;
const data = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < data.length; i++) {
  data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5;
}
const input: AudioInput = { data, sampleRate };
const result = extractFeatures(input);
console.log('Extracted features in content script:', result);
