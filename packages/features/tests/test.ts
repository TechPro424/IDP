// Simple test harness for extractFeatures
import { extractFeatures, AudioInput } from '../src/index.js';

function tone(freq: number, seconds: number, sampleRate: number, amplitude = 0.5): AudioInput {
  const data = new Float32Array(sampleRate * seconds);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amplitude;
  }
  return { data, sampleRate };
}

(async () => {
  const sampleRate = 48000;

  // 6 seconds, not 5: `missing` counts *speech* seconds, and hop-framing means a
  // 5.00 s clip measures 4.96 s of it (the tail has no full frame).
  const result = await extractFeatures(tone(440, 6, sampleRate));
  if (!result.audio) throw new Error('Missing audio');
  const a = result.audio;
  if (a.syntheticLikelihood === undefined) throw new Error('No syntheticLikelihood');
  if (a.syntheticLikelihood < 0 || a.syntheticLikelihood > 1) throw new Error('syntheticLikelihood out of range');
  if (a.missing !== false) throw new Error('missing flag wrong');
  for (const key of ['avgFlatness', 'flatnessVariance', 'avgCentroid', 'centroidVariance', 'voicedRatio', 'jitter', 'loudnessRangeDb', 'nSpeechSeconds'] as const) {
    if (a[key] === undefined) throw new Error(`Missing audio feature ${key}`);
  }
  console.log('All metrics present.');

  // Silence → missing.
  const silence = await extractFeatures({ data: new Float32Array(sampleRate), sampleRate });
  if (silence.audio?.missing !== true) throw new Error('Silence missing flag should be true');
  console.log('Silence test passed.');

  // High-frequency tone (4000Hz).
  const high = await extractFeatures(tone(4000, 5, sampleRate));
  const hfPitch = high.audio?.avgPitch;
  if (hfPitch === undefined || Math.abs(hfPitch - 4000) > 200) throw new Error(`High freq pitch off: ${hfPitch}`);
  console.log('High-frequency tone test passed.');

  // Low-frequency tone (200Hz).
  const low = await extractFeatures(tone(200, 5, sampleRate));
  const lfPitch = low.audio?.avgPitch;
  if (lfPitch === undefined || Math.abs(lfPitch - 200) > 50) throw new Error(`Low freq pitch off: ${lfPitch}`);
  console.log('Low-frequency tone test passed.');

  // Noise → no stable pitch.
  const noiseData = new Float32Array(sampleRate * 5);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  const noise = await extractFeatures({ data: noiseData, sampleRate });
  const noisePitch = noise.audio?.avgPitch;
  if (noisePitch !== undefined && !isNaN(noisePitch)) throw new Error('Noise pitch should be NaN or undefined');
  console.log('Noise test passed.');

  console.log('All feature tests passed.');
})();
