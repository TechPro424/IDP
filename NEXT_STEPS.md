# Project Next Steps

The following list captures the immediate and mid‑term tasks that will move the Slop Filter project toward a production‑ready release.  Each item references the phases, deliverables, and concrete tasks described in the **Implementation Plan**.

---

## Status Overview

| Phase | Completed Tasks | Pending Tasks | Notes |
|-------|-----------------|--------------|-------|
| **0 – Feasibility Spikes** | Spike A: Audio capture strategy (Completed), Spike B: Frame/Shorts behavior (Completed), Spike C: Edge storage benchmark (Completed). | Full spike reports + ADRs completed. | Spikes are completed; decisions will shape the next phases. |
| **1 – Scaffolding** | CI pipeline, monorepo set‑up, TypeScript strict config, lint/format, basic docs. | None – this phase is finished. |  |
| **2 – Shared Feature Library** | Audio, visual, and text feature modules (`packages/features`) with `features.config.json`; parity tests; Node‑CLI script added. | Cross‑platform binary format, documentation of feature dictionary. | Feature parity tests already exist; CLI script added. |
| **3 – Research Harness & Data** | License audit, synthetic & human datasets partially collected; baseline models trained. | Complete dataset assembly, augmentation pipeline, full baseline and model artifacts. |  |
| **4 – Annotation Rubric & Mode** | Draft rubric, initial pilot annotations. | Final rubric, consent flow. | Annotation UI shipped, JSON export added. |
| **5 – Modeling & Calibration** | Logistic regression baseline, calibration. | Final threshold selection, fusion ablation, export of versioned models. |  |
| **6 – Extension MVP** | MV3 extension build, popup UI, audio capture + feature extraction forwarding, Playwright e2e tests, packaging scripts, performance benchmark. | On‑screen overlay (slop indicator, “Show anyway”, per‑dimension explanations), options page (slop thresholds, allowlist, delete‑data), accessibility compliance. | Annotation mode shipped. |
| **7 – Edge Service** | Edge worker with Bloom filter, KV integration, `/v1/bucket` and `/health` endpoints, benchmark script, performance report workflow. | Real Cloudflare KV / Cache API / Upstash benchmarks, padded bucket response spec. | Benchmark placeholder added, privacy‑notice updated. |
| **8 – Evaluation & Reporting** | Protocol design, evaluation plan drafted. | Full evaluation run, results tables, error analysis, limitations section. |  |
| **9 – Documentation & Compliance** | README updated with installation basics. | Compliance register, final abstract. | Threat‑model, privacy notice, data‑flow diagram added. |

---

## Detailed Phase‑by‑Phase Tasks

### Phase 0 – Feasibility Spikes
- **Spike A**: Audio capture on YouTube – implemented using `createMediaElementSource`; fallback to `AudioWorklet` if silent.
- **Spike B**: Frame extraction, Shorts behavior, ad detection – initial tests show canvas down‑sampling works; SPA navigation handling verified. **Completed**.
- **Spike C**: Edge storage benchmark – benchmark script implemented; results used to choose Workers KV. **Completed**.
**Next Step**: All strategy decisions made. Proceed to Phase 1 deliverables.

### Phase 1 – Scaffolding
- Monorepo with pnpm workspaces, strict TypeScript, lint/format, CI (GitHub Actions, no YouTube access), Hydra/uv setup, ADR template, `fixtures/` mock pages.
**Status**: Done.

### Phase 2 – Shared Feature Library
- Implemented audio, visual, and text feature extraction modules in `packages/features`.
- `features.config.json` holds all parameters.
- Unit tests and parity tests against Node‑CLI reference output exist.
**Pending**:
  - Cross‑platform binary format for large feature sets (optional).
  - Documentation of the feature dictionary in the repo.

### Phase 3 – Research Harness & Data
- License audit completed for synthetic and human datasets.
- Baseline models (logistic regression) trained on lab data.
**Pending**:
  - Full dataset assembly, augmentation pipeline (codec, noise, speed).
  - Complete baseline and model artifacts for later phases.

### Phase 4 – Annotation Rubric & Mode
- Draft rubric defined (attention fragmentation, substance, narration origin, epistemic reliability).
- Pilot annotations on ~30 items, κ computed.
**Pending**:
  - Final rubric with written anchors.
  - Consent screen.

### Phase 5 – Modeling & Calibration
- Logistic regression baseline and calibration (isotonic/Platt) implemented.
**Pending**:
  - Final threshold selection on validation data.
  - Fusion ablation (AND, min, product, noisy‑AND, logistic).
  - Export versioned models as JSON/ONNX.

### Phase 6 – Extension MVP
- MV3 extension built with Vite (popup, content script, background).
- Popup includes enable toggle, prefix input, Add & Bloom buttons.
- Background captures tab audio, forwards features, handles Bloom lookups.
- Playwright e2e tests verify UI and network calls.
- Packaging scripts (`vite build`, `package:chrome`, `package:firefox`) and CI packaging steps exist.
- Performance benchmark script for feature extraction and Bloom/KV ops.
**Pending**:
  - On‑screen overlay that shows slop indicator, “Show anyway”, per‑dimension explanations.
  - Options page with slop‑threshold sliders, allowlist/denylist, delete‑data.
  - Accessibility compliance (keyboard operable, ARIA labels).

### Phase 7 – Edge Service
- Cloudflare Worker with Bloom filter, KV integration, `/v1/bucket` and `/health` endpoints, padding logic (in progress).
- Benchmark script measures add/test and KV put/get; workflow generates performance report.
**Pending**:
  - Real benchmarks for Workers KV, Cache API, Upstash.
  - Implementation of padded bucket responses (fixed entry count).

### Phase 8 – Evaluation & Reporting
- Protocol design drafted.
**Pending**:
  - Full evaluation run on the frozen test set.
  - Results tables (precision, recall, AUROC, etc.), error analysis, limitations section.

### Phase 9 – Documentation & Compliance
- README updated with installation basics.
**Pending**:
  - Compliance register, final abstract.

---

## Immediate Next Actions

1. **Strategy decision completed**; proceed to Phase 1 deliverables.
2. **On‑screen Overlay & Options Page** – sketch UI, then implement in the extension.
3. **Consent Flow** – add a consent screen in annotation mode.
4. **Real Edge Benchmarks** – set up Cloudflare Workers KV, Cache API, Upstash tests and collect latency data.
5. **Accessibility Compliance** – ensure extension UI is keyboard operable with ARIA labels.
6. **Padded Bucket Response** – implement fixed‑count padding logic.
7. **Compliance Register & Final Abstract** – complete documentation.

Once these items are completed, the project will be fully functional, fully documented, and ready for a final evaluation.
