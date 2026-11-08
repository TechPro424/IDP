// Audio feature utilities. Browser-safe (Meyda + plain DSP, no node builtins).
// @ts-ignore -- meyda ships no type declarations.
import Meyda from 'meyda';
import { config } from './config.js';

export function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export function computeSpectralFlatness(mags: number[]): number {
  let geom = 0;
  let arith = 0;
  for (const m of mags) {
    geom += Math.log(Math.max(m, 1e-12));
    arith += m;
  }
  geom = Math.exp(geom / mags.length);
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

/**
 * YIN pitch detection (plan §5, §7.1). Steps: squared-difference function,
 * cumulative-mean-normalised difference, absolute threshold (0.1), then
 * parabolic interpolation of the chosen dip. Returns Hz, or NaN for aperiodic
 * frames. `probability` is reported through `computePitchDetail` when callers
 * want the aperiodicity itself.
 */
export function computePitchDetail(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.1,
): { pitch: number; probability: number } {
  const SIZE = buffer.length;
  const tauMax = Math.min(Math.floor(SIZE / 2), Math.floor(sampleRate / 50));
  // 5000 Hz ceiling keeps the estimator usable for the high-tone fixtures while
  // still covering the 60–500 Hz speech band.
  const tauMin = Math.max(2, Math.floor(sampleRate / 5000));
  if (tauMax <= tauMin) return { pitch: NaN, probability: 0 };

  // 1. difference function
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i + tau < SIZE; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // 2. cumulative mean normalised difference
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    runningSum += d[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (d[tau] * tau) / runningSum;
  }

  // 3. absolute threshold: first dip under `threshold`, else the global minimum
  let tau = tauMin;
  while (tau <= tauMax) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }
  if (tau > tauMax) {
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    tau = best;
    if (cmnd[tau] > 0.6) return { pitch: NaN, probability: 1 - cmnd[tau] };
  }

  // 4. parabolic interpolation around the dip
  let betterTau = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) betterTau = tau + (s2 - s0) / denom;
  }
  if (!(betterTau > 0)) return { pitch: NaN, probability: 0 };
  return { pitch: sampleRate / betterTau, probability: 1 - cmnd[tau] };
}

/** Hz, or NaN. Thin wrapper kept for callers that only need the frequency. */
export function computePitch(buffer: Float32Array, sampleRate: number): number {
  return computePitchDetail(buffer, sampleRate).pitch;
}

/**
 * Linear resampling (plan §7.1: lab audio is resampled to 48 kHz to match the
 * browser's AudioContext rate). Good enough for feature extraction; the browser
 * path never resamples because it already runs at the context rate.
 */
export function resampleLinear(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || data.length === 0) return data;
  const ratio = toRate / fromRate;
  const out = new Float32Array(Math.max(1, Math.round(data.length * ratio)));
  for (let i = 0; i < out.length; i++) {
    const src = i / ratio;
    const lo = Math.floor(src);
    const hi = Math.min(data.length - 1, lo + 1);
    const frac = src - lo;
    out[i] = data[lo] * (1 - frac) + data[hi] * frac;
  }
  return out;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

export function mad(xs: number[]): number {
  if (!xs.length) return NaN;
  const m = mean(xs);
  return mean(xs.map((x) => Math.abs(x - m)));
}

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

// Local jitter: mean |f_i - f_{i-1}| relative to mean f.
export function computeJitter(pitches: number[]): number {
  if (pitches.length < 2) return 0;
  const m = mean(pitches);
  if (m <= 0) return 0;
  let sum = 0;
  for (let i = 1; i < pitches.length; i++) sum += Math.abs(pitches[i] - pitches[i - 1]);
  return sum / (pitches.length - 1) / m;
}

export interface AudioFeatures {
  syntheticLikelihood?: number;
  missing?: boolean;
  avgFlatness?: number;
  flatnessVariance?: number;
  avgCentroid?: number;
  centroidVariance?: number;
  avgPitch?: number;
  pitchVariance?: number;
  pitchMad?: number;
  voicedRatio?: number;
  jitter?: number;
  pauseCount?: number;
  pauseMeanSec?: number;
  pauseVarianceSec?: number;
  loudnessRangeDb?: number;
  speechRatio?: number;
  nSpeechSeconds?: number;
  musicSuspected?: boolean;
}

export interface AudioInput {
  data: Float32Array;
  sampleRate: number;
  /**
   * Plan §7.1: lab audio is resampled to 48 kHz so Node and the browser analyse
   * the same band. The extension omits this — it already runs at the
   * AudioContext rate, and resampling there would only cost CPU.
   */
  targetSampleRate?: number;
}

/** Frames between yields to the event loop. ~16 x 1.2 ms keeps each task
 *  under the 50 ms jank budget in docs/manual-smoke.md §8. */
const YIELD_EVERY = 16;

/**
 * Frame the signal and compute the full plan feature set.
 * `syntheticLikelihood` remains a heuristic proxy (S) until a calibrated
 * model exists — see CHECKLIST.md §9.3.
 *
 * Async so the FFT/YIN loop can yield: 6 s of audio is ~560 frames and ~700 ms
 * of work, which would drop playback frames if run as one task. The 6 s capture
 * still completes in well under a second of wall clock.
 */
export async function extractAudioFeatures(input: AudioInput): Promise<AudioFeatures> {
  const target = input.targetSampleRate ?? input.sampleRate;
  const data = resampleLinear(input.data, input.sampleRate, target);
  const sampleRate = data === input.data ? input.sampleRate : target;
  const { frameSize, hopSize, rmsThreshold, minPauseMs, minSpeechSeconds } = config.audio;

  // Object.create, not the module export itself: meyda keeps bufferSize,
  // sampleRate and the current signal on the instance, and this function now
  // yields mid-loop, so two concurrent calls would clobber each other.
  const meydaObj: any = Object.create((Meyda as any).default || Meyda);
  meydaObj.bufferSize = frameSize;
  meydaObj.hopSize = hopSize;
  meydaObj.sampleRate = sampleRate;

  const flatness: number[] = [];
  const centroid: number[] = [];
  const pitches: number[] = [];
  const rmsValues: number[] = [];
  const voicedFlags: boolean[] = [];

  // One scratch frame, refilled per hop: slicing would allocate ~5 MB per 6 s
  // analysis (560 frames x 2048 floats) and it all has to be collected again.
  const frame = new Float32Array(frameSize);
  let sinceYield = 0;
  for (let i = 0; i + frameSize <= data.length; i += hopSize) {
    if (++sinceYield >= YIELD_EVERY) {
      sinceYield = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    frame.set(data.subarray(i, i + frameSize));
    const rms = computeRMS(frame);
    rmsValues.push(rms);
    voicedFlags.push(rms > rmsThreshold);

    const feats: any = meydaObj.extract ? meydaObj.extract(['spectralFlatness', 'spectralCentroid'], frame) : {};
    // An exact-zero frame makes meyda divide by zero (flatness exp(-Inf), centroid
    // 0/0). Decoded pauses really are digital silence, and a NaN here would defeat
    // every downstream comparison, so keep only finite values.
    const flat = feats?.spectralFlatness;
    flatness.push(Number.isFinite(flat) ? flat : 0);
    // meyda reports the centroid as an FFT bin index; the feature contract is Hz.
    const cent = feats?.spectralCentroid;
    centroid.push(Number.isFinite(cent) ? (cent * sampleRate) / frameSize : 0);

    if (rms > rmsThreshold) {
      const pitch = computePitch(frame, sampleRate);
      if (!isNaN(pitch)) pitches.push(pitch);
    }
  }

  const voicedFrames = voicedFlags.filter(Boolean).length;
  const totalFrames = voicedFlags.length || 1;
  const voicedRatio = voicedFrames / totalFrames;
  const nSpeechSeconds = (voicedFrames * hopSize) / sampleRate;
  // docs/features.md: missing means "not enough speech", not "short file" - a 30 s
  // music bed is absent, not confidently clean.
  const missing = nSpeechSeconds < minSpeechSeconds;

  // Pause stats: runs of unvoiced frames longer than minPauseMs.
  const minPauseFrames = Math.max(1, Math.round((minPauseMs / 1000) * (sampleRate / hopSize)));
  const pauses: number[] = [];
  let run = 0;
  for (const voiced of voicedFlags) {
    if (!voiced) run++;
    else {
      if (run >= minPauseFrames) pauses.push((run * hopSize) / sampleRate);
      run = 0;
    }
  }
  if (run >= minPauseFrames) pauses.push((run * hopSize) / sampleRate);

  const rmsDb = rmsValues.map((r) => 20 * Math.log10(Math.max(r, 1e-6)));
  const loudnessRangeDb = rmsDb.length ? percentile(rmsDb, 95) - percentile(rmsDb, 5) : 0;

  const avgFlatness = mean(flatness);
  // ponytail: music heuristic — little speech but real signal energy.
  const musicSuspected = voicedRatio < 0.3 && mean(rmsValues) > rmsThreshold;

  return {
    syntheticLikelihood: Math.min(1, Math.max(0, voicedRatio * 2)),
    missing,
    avgFlatness: isNaN(avgFlatness) ? 0 : avgFlatness,
    flatnessVariance: variance(flatness),
    avgCentroid: isNaN(mean(centroid)) ? 0 : mean(centroid),
    centroidVariance: variance(centroid),
    avgPitch: pitches.length ? mean(pitches) : NaN,
    pitchVariance: variance(pitches),
    pitchMad: pitches.length ? mad(pitches) : NaN,
    voicedRatio,
    jitter: computeJitter(pitches),
    pauseCount: pauses.length,
    pauseMeanSec: pauses.length ? mean(pauses) : 0,
    pauseVarianceSec: variance(pauses),
    loudnessRangeDb,
    speechRatio: voicedRatio,
    nSpeechSeconds,
    musicSuspected,
  };
}
