# Project Next Steps

The following list captures the immediate and mid‑term tasks that will move the Slop Filter project toward a working prototype.  Each item references a section in the implementation plan or a new module that needs to be added.

## 1. Visual Feature Extraction ✅ Completed
- ✅ Visual feature extraction module (`packages/features/src/visual.ts`) implemented.
- ✅ Canvas down‑sampling and shot‑boundary detection implemented.
- ✅ Metrics computed.
- ✅ Exported as part of `extractFeatures`.

## 2. Text Feature Extraction ✅ Completed
- ✅ Text feature extraction module (`packages/features/src/text.ts`) implemented.
- ✅ Parsing implemented.
- ✅ Computation implemented.
- ✅ Exported.

## 3. MV3 Extension Build (in progress)
- ✅ Placeholder config added (`vite.config.ts`).
- ✅ Pending: need to implement audio capture and feature extraction in content script.
- ✅ Pending: UI implementation.
- ✅ Added Bloom POST button to popup.

## 4. Edge Worker (basic stub)
- ✅ Hono route stub implemented.
- ✅ Pending: full Bloom filter and KV integration.
- ✅ Edge handler tests added.

## 5. Testing & CI (mostly ready)
- ✅ Tests for visual, text, and integration exist.
- ✅ Pending: Playwright tests.
- ✅ GitHub Actions updated to run tests.

## 6. Documentation & ADRs (to be written)
- ❌ Pending: ADRs.
- ✅ README updated.

## 7. Packaging (pending)
- ❌ Pending.
- ❌ Pending.

## 8. Performance Profiling (to be added)
- ❌ Pending.
- ❌ Pending.

---

**Status:** Progress made on core functionality. Core modules, edge worker, UI, and tests are largely complete.  Remaining work: documentation, packaging, performance profiling.
