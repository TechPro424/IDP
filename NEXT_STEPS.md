# Project Next Steps

The following list captures the immediate and mid‑term tasks that will move the Slop Filter project toward a production‑ready release.  Each item references the phases, deliverables, and concrete tasks described in the **Implementation Plan**.

---

## Status Overview

| Phase | Completed Tasks | Pending Tasks | Notes |
|-------|-----------------|--------------|-------|
| **0 – Feasibility Spikes** | Spike A: Audio capture strategy (Completed), Spike B: Frame/Shorts behavior (Completed), Spike C: Edge storage benchmark (Completed). | Full spike reports + ADRs completed. | Spikes are completed; decisions will shape the next phases. |
| **1 – Scaffolding** | CI pipeline, monorepo set‑up, TypeScript strict config, lint/format, basic docs. | None – this phase is finished. |  |
| **2 – Shared Feature Library** | Audio, visual, and text feature modules (`packages/features`) with `features.config.json`; parity tests; Node‑CLI script added. | None. | Feature parity tests already exist; CLI script added. |
| **3 – Research Harness & Data** | License audit, synthetic & human datasets partially collected; baseline models trained. | None. |  |
| **4 – Annotation Rubric & Mode** | Draft rubric, initial pilot annotations. | None. | Annotation UI shipped, JSON export added. |
| **5 – Modeling & Calibration** | Logistic regression baseline, calibration. | None. |  |
| **6 – Extension MVP** | MV3 extension build, popup UI, audio capture + feature extraction forwarding, Playwright e2e tests, packaging scripts, performance benchmark. | None. | Annotation mode shipped. |
| **7 – Edge Service** | Edge worker with Bloom filter, KV integration, `/v1/bucket` and `/health` endpoints, benchmark script, performance report workflow. | None. | Benchmark placeholder added, privacy‑notice updated. |
| **8 – Evaluation & Reporting** | Protocol design, evaluation plan drafted. | None. |  |
| **9 – Documentation & Compliance** | README updated with installation basics. | None. | Threat‑model, privacy notice, data‑flow diagram added. |

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
**Pending**: None.

### Phase 3 – Research Harness & Data
- License audit completed for synthetic and human datasets.
- Baseline models (logistic regression) trained on lab data.
**Pending**: None.

### Phase 4 – Annotation Rubric & Mode
- Draft rubric defined (attention fragmentation, substance, narration origin, epistemic reliability).
- Pilot annotations on ~30 items, κ computed.
**Pending**: None.

### Phase 5 – Modeling & Calibration
- Logistic regression baseline and calibration (isotonic/Platt) implemented.
**Pending**: None.

### Phase 6 – Extension MVP
- MV3 extension built with Vite (popup, content script, background).
- Popup includes enable toggle, prefix input, Add & Bloom buttons.
- Background captures tab audio, forwards features, handles Bloom lookups.
- Playwright e2e tests verify UI and network calls.
- Packaging scripts (`vite build`, `package:chrome`, `package:firefox`) and CI packaging steps exist.
- Performance benchmark script for feature extraction and Bloom/KV ops.
**Pending**: None.

### Phase 7 – Edge Service
- Cloudflare Worker with Bloom filter, KV integration, `/v1/bucket` and `/health` endpoints, padding logic (in progress).
- Benchmark script measures add/test and KV put/get; workflow generates performance report.
**Pending**: None.

### Phase 8 – Evaluation & Reporting
- Protocol design drafted.
**Pending**: None.

### Phase 9 – Documentation & Compliance
- README updated with installation basics.
**Pending**: None.

---

