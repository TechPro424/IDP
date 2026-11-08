# Next Steps

The honest version. Everything below is blocked on something, or is genuinely unfinished.
`CHECKLIST.md` has the item-by-item state with file:line evidence.

## 1. Data (blocks everything else)

- [ ] Acquire ≥ 100 clips per rubric quadrant (~250 stretch), keeping a generator/speaker
      split that survives to the test set.
- [ ] ≥ 4 TTS families for the synthetic side, ≥ 2 of them held out entirely for test.
- [ ] Fill in `docs/license_audit.md` **before** the first download.
- [ ] Run the annotation pilot with ≥ 2 annotators per clip, compute κ/α, and rewrite the
      rubric if κ < 0.6 (`docs/rubric/adjudication.md` lists the stop conditions).

## 2. Model

- [ ] `packages/scripts/train-model.py` on the real train/val split → overwrite the prior in
      `packages/scoring/src/model.ts`, bump `ML_MODEL_VERSION`.
- [ ] `packages/scripts/compute-thresholds.sh` on validation only.
- [ ] Calibration: pick the method with the lower ECE on validation (the script reports all
      three); decide whether the runtime ships calibrated or raw scores.
- [ ] Replace the `syntheticLikelihood` proxy with a real detector — this is the single
      largest quality gap.

## 3. Evaluation

- [ ] Frozen test set produced by `packages/scripts/assemble-dataset.sh` from held-out
      generators; `packages/scripts/evaluate.sh` currently **refuses** to run without
      `labels.csv`, which is the correct behaviour until then.
- [ ] Per-quadrant precision/recall/F1, AUROC with bootstrap CI, PR-AUC.
- [ ] Robustness: codec re-encode, added noise, background music, playback speed, music-only.
- [ ] Fairness slices by language and accent.

## 4. Extension

- [ ] Playwright fixtures for a mock watch page, a Short, and an ad break — then real e2e
      coverage. The current specs need a browser and do not cover content-script behaviour.
- [ ] Silence guard on audio capture (ADR 004).
- [ ] Keyboard/focus audit of the overlay; high-contrast variant.
- [ ] Decide whether frame sampling needs a worker (only if profiling says so).

## 5. Edge

- [ ] Deploy to a staging Worker with a real KV binding; run
      `packages/edge/scripts/benchmark-edge-real.ts` per region and replace ADR 006's
      hypothesis with measurements.
- [ ] Rate limiting at the Cloudflare zone (not in code).
- [ ] Signed verdict-set manifests, so a client can detect suppression.
- [ ] Anonymity analysis: what prefix length actually buys, given cross-request linkability.

## 6. Process

- [ ] `pnpm audit` (or equivalent) gate in CI.
- [ ] ESLint/Prettier + Ruff/pytest, currently absent despite the plan listing them.
- [ ] `research/` harness (Hydra, MLflow) — nothing exists yet.
- [ ] Rewrite any remaining doc that asserts unbuilt work. ADR 004/005/006/007, the compliance
      register, the abstract and this file have been corrected; re-check after each change.

## Explicitly not planned

- Blocking playback. The extension is advisory; anything else needs a dispute channel first.
- Publishing a slop list. Same reason.
- Fact-checking claims. Out of scope per the plan.