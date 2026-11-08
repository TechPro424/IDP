import { extractFeatures, AudioInput } from '../src/index.js';

// 1s of 440Hz + one synthetic frame pair + text → all three modalities present.
const sampleRate = 48000;
const data = new Float32Array(sampleRate);
for (let i = 0; i < data.length; i++) data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
const input: AudioInput = { data, sampleRate };

function frame(v: number) {
  const img = { width: 64, height: 36, data: new Uint8ClampedArray(64 * 36 * 4) };
  for (let i = 0; i < 64 * 36; i++) {
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

(async () => {
  const result = await extractFeatures(input, [frame(10), frame(220), frame(10)], 'Hello world! Hello again. Test test test.');
  console.log('Integration result:', JSON.stringify(result));
  if (!result.audio) throw new Error('Missing audio');
  if (!result.visual) throw new Error('Missing visual');
  if (!result.text) throw new Error('Missing text');
  if (result.visual!.colorHistogram.length === 0) throw new Error('Missing color histogram');
  if (result.text!.sentenceLengthVariance === undefined) throw new Error('Missing sentence-length variance');
  console.log('Integration test passed.');
})();
