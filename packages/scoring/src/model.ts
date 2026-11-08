// Runtime model coefficients.
// ponytail: inlined instead of importing ../model.json — the runtime is a
// browser bundle and cannot readFileSync. train-model.py still writes
// model.json as the research artefact; keep the two in sync when retraining
// (see packages/scripts/export-models.sh).
export interface FusionModel {
  coefficients: { S: number; H: number; SH: number };
  intercept: number;
}

// PRIOR, not a fitted model: hand-set so the pipeline runs before any labelled
// data exists. Replace via packages/scripts/train-model.py and bump the version.
export const DEFAULT_MODEL: FusionModel = {
  coefficients: { S: 0.8, H: 0.6, SH: 0.4 },
  intercept: -0.5,
};

/** Cache key: changes whenever the coefficients change. */
export const ML_MODEL_VERSION = `model-${DEFAULT_MODEL.intercept}:${DEFAULT_MODEL.coefficients.S}:${DEFAULT_MODEL.coefficients.H}:${DEFAULT_MODEL.coefficients.SH}`;

export function applyModel(model: FusionModel, S: number, H: number): number {
  const z = model.intercept + model.coefficients.S * S + model.coefficients.H * H + model.coefficients.SH * S * H;
  return 1 / (1 + Math.exp(-z));
}
