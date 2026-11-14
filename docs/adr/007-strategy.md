# ADR 007: Chosen Architecture

## Decision
- **Audio** — `createMediaElementSource` + `AnalyserNode` polling (see ADR 004).
- **Vision** — 64×36 hidden canvas at ~6 fps, `VisualAnalyzer` (see ADR 005).
- **Ads / Shorts / SPA** — `ad-showing` observer, `/shorts/` parsing, `yt-navigate-finish` + URL poll.
- **Edge storage** — Workers KV, versioned Bloom blob (see ADR 006).
- **Content hashing** — WebCrypto `SHA-256` of the canonical watch URL; `prefix = h[0:5]`, `suffix = h[5:16]`.
- **Edge lookups** — Bloom test locally first; only a Bloom-positive triggers `GET /v1/bucket/{prefix}`. The bucket is padded to 32 entries so a response does not reveal occupancy. Nothing else ever leaves the device.
- **Scoring** — feature extraction in the content script, scoring and verdict in the service worker. Fusion is `min(S, H)` with `H = mean(Hatt, Hsub)`, a ±`grayBand` REVIEW zone, and a `BLOCK` only when `S ≥ τs ∧ H ≥ τh`.
- **Cache** — IndexedDB, 7-day TTL, invalidated when the model version string changes.
- **UI** — popup (enable toggle, "Analyze this video"), closed-Shadow-DOM overlay with advisory wording, a "Why?" panel, "Show anyway" and "This looks fine"; options page for consent, thresholds, policy, edge origin, lists, annotation and reduced motion.
- **Privacy** — opt-in, no telemetry, no remote code, `chrome.storage.local` only, one-click "Delete all local data".

## Consequences
- The extension is useful offline: with no edge origin set, everything except live corpus updates works.
- `S`, `Hatt` and `Hsub` are heuristics (`packages/scoring/src/proxies.ts`), not a calibrated model. The overlay must therefore stay advisory.
- Two build passes are required (classic-script content bundle + ES-module pages), see `packages/extension/vite.config.ts`.

## Status
- **Implemented** — all of the above exists; see `CHECKLIST.md` for per-item state and evidence.
- **Not verified** — accuracy, calibration and latency. No labelled dataset exists yet.
- **Future work** — calibration on real annotations, then a decision about whether the overlay may ever use stronger wording.