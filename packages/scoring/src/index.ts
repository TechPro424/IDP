// Sub-score types, fusion, verdict logic.
// Each sub-score in [0, 1] or `undefined` (missing modality).
import { DEFAULT_MODEL, applyModel, type FusionModel } from './model.js';

export type { FusionModel } from './model.js';
export { DEFAULT_MODEL } from './model.js';

export interface SubScores {
  S?: number;       // synthetic-narration likelihood
  Hatt?: number;    // attention-fragmentation proxy
  Hsub?: number;    // substance-deficit proxy
}

export interface Thresholds {
  tauS: number;
  tauH: number;
  /** Half-width of the REVIEW gray band around each threshold. */
  grayBand: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { tauS: 0.6, tauH: 0.6, grayBand: 0.1 };

export const MISSING_MODALITY_POLICY = {
  SUSPEND: 'suspend',
  TREAT_SAFE: 'treat_safe',
  TREAT_RISKY: 'treat_risky',
} as const;
export type MissingModalityPolicy = (typeof MISSING_MODALITY_POLICY)[keyof typeof MISSING_MODALITY_POLICY];

export enum Verdict {
  ALLOW = 'ALLOW',
  REVIEW = 'REVIEW',
  BLOCK = 'BLOCK',
}

export interface ScoreResult {
  H?: number;
  SRS?: number;
  verdict: Verdict;
}

export function computeH(s: SubScores): number | undefined {
  if (s.Hatt == null || s.Hsub == null) return undefined;
  return (s.Hatt + s.Hsub) / 2;
}

export function computeSRS(s: SubScores): number | undefined {
  const H = computeH(s);
  if (s.S == null || H == null) return undefined;
  return Math.min(s.S, H);
}

// ---- Fusion ablations -------------------------------------------------------
export function fuseAnd(s: SubScores): number | undefined { return computeSRS(s); }
export function fuseMin(s: SubScores): number | undefined { return computeSRS(s); }
export function fuseProduct(s: SubScores): number | undefined {
  const H = computeH(s);
  if (s.S == null || H == null) return undefined;
  return s.S * H;
}
export function fuseNoisyAnd(s: SubScores): number | undefined {
  const H = computeH(s);
  if (s.S == null || H == null) return undefined;
  return Math.max(0, Math.min(1, (s.S + H) / 2 - 0.1));
}
export function makeLogisticFusion(model: FusionModel = DEFAULT_MODEL) {
  return (s: SubScores): number | undefined => {
    const H = computeH(s);
    if (s.S == null || H == null) return undefined;
    return applyModel(model, s.S, H);
  };
}
export const fuseLogistic = makeLogisticFusion();

export type Fusion = (s: SubScores) => number | undefined;

export function decide(
  s: SubScores,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
  policy: MissingModalityPolicy = MISSING_MODALITY_POLICY.SUSPEND,
  fusion: Fusion = fuseAnd,
): ScoreResult {
  const { tauS, tauH, grayBand } = thresholds;
  const h = computeH(s);
  const srs = fusion(s);

  if (s.S == null) {
    return {
      H: h,
      SRS: undefined,
      verdict: policy === MISSING_MODALITY_POLICY.TREAT_SAFE ? Verdict.ALLOW : Verdict.REVIEW,
    };
  }
  if (h == null) {
    return { H: undefined, SRS: undefined, verdict: Verdict.REVIEW };
  }
  // Gray band: anything near either threshold is advisory REVIEW, never BLOCK.
  const near = (v: number, tau: number) => Math.abs(v - tau) <= grayBand;
  if (near(s.S, tauS) || near(h, tauH)) {
    return { H: h, SRS: srs, verdict: Verdict.REVIEW };
  }
  if (s.S >= tauS && h >= tauH) return { H: h, SRS: srs, verdict: Verdict.BLOCK };
  return { H: h, SRS: srs, verdict: Verdict.ALLOW };
}

/** Per-dimension explanations for the overlay "Why?" panel. */
export function explain(s: SubScores): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  rows.push({
    label: 'Synthetic narration',
    value: s.S == null ? 'No speech detected' : s.S >= 0.6 ? 'Likely synthetic' : 'Appears human',
  });
  if (s.Hatt != null) {
    rows.push({ label: 'Attention fragmentation', value: s.Hatt >= 0.6 ? 'High (rapid pacing)' : 'Normal pacing' });
  }
  if (s.Hsub != null) {
    rows.push({ label: 'Substance deficit', value: s.Hsub >= 0.6 ? 'Low substance' : 'Appears substantive' });
  }
  return rows;
}
