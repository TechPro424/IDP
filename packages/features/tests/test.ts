// Simple test harness for extractFeatures
import { extractFeatures, AudioInput } from '../src/index';

// Generate a 1‑second 440Hz sine wave at 48kHz
const sampleRate = 48000;
const durationSec = 1;
const freq = 440;
const data = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < data.length; i++) {
  data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5; // amplitude 0.5
}
const input: AudioInput = { data, sampleRate };
const result = extractFeatures(input);
console.log('Result:', JSON.stringify(result, null, 2));
if (!result.audio) throw new Error('Missing audio');
const { syntheticLikelihood, missing, avgFlatness, avgCentroid, avgPitch } = result.audio;
if (syntheticLikelihood === undefined) throw new Error('No syntheticLikelihood');
if (syntheticLikelihood < 0 || syntheticLikelihood > 1) throw new Error('syntheticLikelihood out of range');
if (missing !== false) throw new Error('missing flag wrong');
if (avgFlatness === undefined) throw new Error('No avgFlatness');
if (avgCentroid === undefined) throw new Error('No avgCentroid');
if (avgPitch === undefined) throw new Error('No avgPitch');
console.log('All metrics present.');

// Silence test
const silence: Float32Array = new Float32Array(sampleRate * durationSec);
const silenceInput: AudioInput = { data: silence, sampleRate };
const silenceResult = extractFeatures(silenceInput);
if (!silenceResult.audio) throw new Error('Silence missing audio');
if (silenceResult.audio.missing !== true) throw new Error('Silence missing flag should be true');
console.log('Silence test passed.');

// High-frequency tone (4000Hz)
const highFreq = 4000;
const highData = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < highData.length; i++) {
  highData[i] = Math.sin((2 * Math.PI * highFreq * i) / sampleRate) * 0.5;
}
const highInput: AudioInput = { data: highData, sampleRate };
const highResult = extractFeatures(highInput);
if (!highResult.audio) throw new Error('High freq missing audio');
const hfPitch = highResult.audio.avgPitch;
if (hfPitch === undefined) throw new Error('High freq avgPitch undefined');
if (Math.abs(hfPitch - highFreq) > 200) throw new Error(`High freq pitch off: ${hfPitch}`);
console.log('High-frequency tone test passed.');

// Low-frequency tone (200Hz)
const lowFreq = 200;
const lowData = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < lowData.length; i++) {
  lowData[i] = Math.sin((2 * Math.PI * lowFreq * i) / sampleRate) * 0.5;
}
const lowInput: AudioInput = { data: lowData, sampleRate };
const lowResult = extractFeatures(lowInput);
if (!lowResult.audio) throw new Error('Low freq missing audio');
const lfPitch = lowResult.audio.avgPitch;
if (lfPitch === undefined) throw new Error('Low freq avgPitch undefined');
if (Math.abs(lfPitch - lowFreq) > 50) throw new Error(`Low freq pitch off: ${lfPitch}`);
console.log('Low-frequency tone test passed.');

// Noise test
const noise = new Float32Array(sampleRate * durationSec);
for (let i = 0; i < noise.length; i++) {
  noise[i] = Math.random() * 2 - 1;
}
const noiseInput: AudioInput = { data: noise, sampleRate };
const noiseResult = extractFeatures(noiseInput);
if (!noiseResult.audio) throw new Error('Noise missing audio');
const noisePitch = noiseResult.audio.avgPitch;
if (noisePitch === undefined || isNaN(noisePitch)) throw new Error('Noise pitch should be NaN or undefined');
console.log('Noise test passed.');
