// Audio feature utilities using Meyda (optional) or custom FFT
// FFT functionality removed – not used in current implementation.

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
  // Autocorrelation pitch detection
  const SIZE = buffer.length;
  const maxLag = Math.floor(sampleRate / 50); // 50Hz min pitch
  const minLag = Math.max(2, Math.floor(sampleRate / 5000)); // 5000Hz max pitch

  const r = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    r[lag] = sum;
  }
  if (r[0] === 0) return NaN;

  for (let lag = minLag; lag < maxLag; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] > r[lag + 1] && r[lag] > 0.3 * r[0]) {
      return sampleRate / lag;
    }
  }
  return NaN;
}
