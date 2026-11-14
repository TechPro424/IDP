// Proxy sub-scores derived from raw features.
// These are heuristic stand-ins used until a calibrated model exists
// (CHECKLIST.md §9.3). Keep the formulas monotone and documented.
import type { SubScores } from './index.js';

export interface FeatureLike {
  audio?: {
    syntheticLikelihood?: number;
    voicedRatio?: number;
    missing?: boolean;
    pauseMeanSec?: number;
    pauseVarianceSec?: number;
  };
  visual?: { cutsPerMinute?: number; staticFrameRatio?: number; asiCV?: number };
  text?: { tokenEntropy?: number; typeTokenRatio?: number; repeatedNgramRatio?: number; gzipRatio?: number };
}

export const ATTENTION_CUTS_PER_MINUTE_CAP = 40;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Weighted mean over the terms that are actually present (weights renormalise). */
function blend(parts: [number | undefined, number][]): number | undefined {
  let sum = 0;
  let weight = 0;
  for (const [value, w] of parts) {
    if (value == null) continue;
    sum += clamp01(value) * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : undefined;
}

/**
 * S  — synthetic-narration likelihood (from audio).
 * Hatt — attention-fragmentation proxy: cut rate, cut-spacing regularity
 *        (metronomic editing) and audio pacing regularity.
 * Hsub — substance-deficit proxy: lexical density plus slideshow staticness.
 * A modality that is absent yields `undefined` for its score so the
 * missing-modality policy applies.
 */
export function deriveSubScores(f: FeatureLike): SubScores {
  const out: SubScores = {};

  if (f.audio && f.audio.missing !== true && f.audio.syntheticLikelihood != null) {
    out.S = clamp01(f.audio.syntheticLikelihood);
  }

  const cuts = f.visual?.cutsPerMinute != null ? f.visual.cutsPerMinute / ATTENTION_CUTS_PER_MINUTE_CAP : undefined;
  // Human edits cluster cuts in bursts (high CV); template-driven edits are even.
  const cutRegularity = f.visual?.asiCV != null ? 1 - clamp01(f.visual.asiCV) : undefined;
  // TTS and template narration pause on a metronome (plan §7.1).
  const pauseRegularity = pauseCv(f.audio) != null ? 1 - clamp01(pauseCv(f.audio)!) : undefined;

  const hatt = blend([
    [cuts, 0.6],
    [cutRegularity, 0.25],
    [pauseRegularity, 0.15],
  ]);
  if (hatt != null) out.Hatt = hatt;

  const entropy = clamp01((f.text?.tokenEntropy ?? 0) / 5); // ~5 bits ≈ rich text
  const ttr = clamp01(f.text?.typeTokenRatio ?? 0);
  const repetition = clamp01(f.text?.repeatedNgramRatio ?? 0);
  const density = 0.6 * entropy + 0.4 * (1 - repetition) * (0.5 + 0.5 * ttr);
  const textDeficit = f.text ? 1 - density : undefined;
  // A near-static frame stream is a slide deck: nothing to attend to.
  const hsub = blend([
    [textDeficit, 0.7],
    [f.visual?.staticFrameRatio, 0.3],
  ]);
  if (hsub != null) out.Hsub = hsub;

  return out;
}

/** Coefficient of variation of inter-speech pauses, when there are enough. */
function pauseCv(audio: FeatureLike['audio']): number | undefined {
  if (!audio || audio.pauseVarianceSec == null || !audio.pauseMeanSec) return undefined;
  return Math.sqrt(Math.max(0, audio.pauseVarianceSec)) / audio.pauseMeanSec;
}
