// packages/scoring/src/index.ts — sub-score types, fusion, verdict logic.
// Each sub-score in [0, 1] or `undefined` (missing modality).

export interface SubScores {
  S?: number;       // synthetic‑narration likelihood
  Hatt?: number;    // attention‑fragmentation proxy
  Hsub?: number;    // substance‑deficit proxy
}

export interface Thresholds {
  tauS: number;
  tauH: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { tauS: 0.6, tauH: 0.6 };

export const MISSING_MODALITY_POLICY = {
  SUSPEND: 'suspend', // missing S → never block, at most REVIEW
  TREAT_SAFE: 'treat_safe', // missing S → ALLOW
  TREAT_RISKY: 'treat_risky', // missing S → REVIEW
} as const;
export type MissingModalityPolicy = typeof MISSING_MODALITY_POLICY[keyof typeof MISSING_MODALITY_POLICY];

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

// Harm proxy H = mean(Hatt, Hsub) when both present.
export function computeH(s: SubScores): number | undefined {
  if (s.Hatt == null || s.Hsub == null) return undefined;
  return (s.Hatt + s.Hsub) / 2;
}

// SRS = AND‑style intersection: min(S, H).
export function computeSRS(s: SubScores): number | undefined {
  const H = computeH(s);
  if (s.S == null || H == null) return undefined;
  return Math.min(s.S, H);
}

// Fusion ablation strategies.
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
export function fuseLogistic(s: SubScores): number | undefined {
  const H = computeH(s);
  if (s.S == null || H == null) return undefined;
  const z = 5 * (s.S - 0.5) + 5 * (H - 0.5);
  return 1 / (1 + Math.exp(-z));
}

export function decide(s: SubScores, thresholds?: Thresholds, policy?: MissingModalityPolicy, fusion?: (s: SubScores)=>number | undefined): ScoreResult {
  const { tauS, tauH } = thresholds ?? DEFAULT_THRESHOLDS;
  const h = computeH(s);
  const fusionFunc = fusion ?? fuseAnd;
  const srs = fusionFunc(s);

  // Missing‑modality policy.
  if (s.S == null) {
    const p = policy ?? MISSING_MODALITY_POLICY.SUSPEND;
    return { H: h, SRS: undefined, verdict: p === MISSING_MODALITY_POLICY.TREAT_SAFE ? Verdict.ALLOW : Verdict.REVIEW };
  }
  if (h == null) {
    return { H: undefined, SRS: undefined, verdict: Verdict.REVIEW };
  }
  if (s.S >= tauS && h >= tauH) return { H: h, SRS: srs, verdict: Verdict.BLOCK };
  return { H: h, SRS: srs, verdict: Verdict.ALLOW };
}

// Per‑dimension explanations for the overlay.
export function explain(s: SubScores): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  rows.push({ label: 'Synthetic narration', value: s.S == null ? 'No speech detected' : s.S >= 0.6 ? 'Likely synthetic' : 'Appears human' });
  if (s.Hatt != null) rows.push({ label: 'Attention fragmentation', value: s.Hatt >= 0.6 ? 'High (rapid pacing)' : 'Normal pacing' });
  if (s.Hsub != null) rows.push({ label: 'Substance deficit', value: s.Hsub >= 0.6 ? 'Low substance' : 'Appears substantive' });
  return rows;
}
