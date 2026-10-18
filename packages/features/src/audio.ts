// Audio feature utilities using Meyda (optional) or custom FFT
import { fft as FFT } from 'fft-js';

export function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export function computeSpectralFlatness(mags: number[]): number {
  let geom = 1;
  let arith = 0;
  for (const m of mags) {
    geom *= Math.max(m, 1e-12);
    arith += m;
  }
  geom = Math.pow(geom, 1 / mags.length);
  arith = arith / mags.length;
  return geom / (arith + 1e-12);
}

export function computeSpectralCentroid(freqs: number[], mags: number[]): number {
  let sumFreqMag = 0;
  let sumMag = 0;
  for (let i = 0; i < freqs.length; i++) {
    sumFreqMag += freqs[i] * mags[i];
    sumMag += mags[i];
  }
  return sumMag > 0 ? sumFreqMag / sumMag : 0;
}

export function computePitch(buffer: Float32Array, sampleRate: number): number {
  // Simple autocorrelation pitch detection
  const SIZE = buffer.length;
  const maxLag = Math.floor(sampleRate / 50); // 50Hz min pitch
  const minLag = Math.floor(sampleRate / 400); // 400Hz max pitch
  let bestLag = minLag;
  let bestCorr = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  return sampleRate / bestLag;
}
