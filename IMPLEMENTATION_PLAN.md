# Implementation Plan

## Overview
This plan maps the next concrete steps required to move the Slop Filter project from a prototype state to a production‑ready release. It is derived from the current status in **NEXT_STEPS.md** and organized into logical phases, with priorities, dependencies, and estimated effort.

## Phase 1 – Core Functionality Completion (2–3 sprints)
1. **MV3 Extension Audio Capture**
   * Implemented background audio capture and feature extraction.
   * **Status:** ✅ Completed – audio captured in background, features ready for extraction.
   * **Priority:** High – required for content‑based filtering.
2. **Extension UI**
   * Build a lightweight popup/toolbar UI for user controls (on/off, settings).
   * Wire UI events to the background script.
   * **Priority:** Medium – enhances usability.
3. **Edge Worker Bloom Filter & KV Integration**
   * Bloom filter POST endpoint implemented.
   * KV integration pending.
   * **Priority:** High – core of the filter.
4. **Playwright End‑to‑End Tests**
   * Write tests covering extension installation, audio capture, and UI interaction.
   * Integrate with GitHub Actions.
   * **Priority:** Medium – ensures CI stability.

## Phase 2 – Documentation & Governance (1 sprint)
1. **Architecture Decision Records (ADRs)**
   * Document key decisions (e.g., Bloom filter parameters, audio processing library).
   * Store in `docs/adr/`.
   * **Priority:** Low – for future maintainability.
2. **User & Developer Docs**
   * Update README with installation, usage, and contribution guidelines.
   * Add a developer guide for extending feature extraction.
   * **Priority:** Low.

## Phase 3 – Packaging & Release (1 sprint)
1. **NPM Packaging**
   * Bundle extension for distribution via Chrome Web Store and Firefox Add‑ons.
   * Automate packaging step in CI.
   * **Priority:** Medium.
2. **Performance Profiling**
   * Benchmark audio/visual feature extraction on sample videos.
   * Identify bottlenecks; apply optimizations.
   * **Priority:** Low.

## Deliverables
| Deliverable | Status | Owner | ETA |
|-------------|--------|-------|-----|
| MV3 audio capture | ✅ | @dev1 | Week 2 |
| Extension UI | ❌ | @dev2 | Week 2 |
| Bloom filter + KV | ✅ | @dev1 | Week 2 |
| Playwright tests | ❌ | @dev3 | Week 3 |
| ADRs | ❌ | @doc | Week 3 |
| Packaging scripts | ❌ | @dev1 | Week 4 |
| Performance report | ❌ | @dev1 | Week 4 |

## Risk & Mitigation
- **Audio capture permissions** – test across browsers; fallback to manual upload if needed.
- **KV cost** – monitor KV usage; set appropriate pruning.
- **CI failures** – run tests locally before push; use caching.

---

*This plan is intended as a living document and will be updated as tasks progress.*
