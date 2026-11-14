# ADR 005: Spike B — Frame Extraction, Shorts, Ad Detection

## Context
The extension needs visual features (pacing/fragmentation), must identify Shorts, and must not analyze ads or preloaded neighbour videos.

## Decision
- **Frames:** draw the `<video>` into an in-memory 64×36 `<canvas>` with `willReadFrequently: true` and read `ImageData` at ~6 fps. `OffscreenCanvas`/workers are deliberately **not** used: 2 304 pixels per frame is cheap and a worker adds build + messaging complexity for no measured gain. `VisualAnalyzer` (`packages/features/src/visual.ts`) consumes the frames directly.
- **Shorts:** `videoIdOf()` parses `/shorts/<id>` and falls back to `?v=`.
- **SPA navigation:** listen for `yt-navigate-finish`, plus a 2 s URL poll as a safety net; a changed id resets state, dismisses the overlay and re-arms analysis.
- **Ads:** `observeAds()` watches the `ad-showing` class on `#movie_player` / `.html5-video-player` with a `MutationObserver`; sampling loops stop while it is set.
- **Per-video state:** one module-level `currentVideoId`; no work happens for a video that is not the current one.

## Not implemented
- `ytp-ad-skip-button` fallback detection.
- Off-main-thread frame analysis.
- "Analyze only the playing video" when several `<video>` elements exist (we take the first).

## Status
- **Implemented:** `sampleFrames()`, `videoIdOf()`, `observeAds()`, `onNavigate()` in `packages/extension/content.ts`.
- **Not tested:** no fixture mocks a watch page, a Short, or an ad break. An earlier version of this ADR claimed the Playwright suite covered ad detection; it did not.
- **Future work:** mock pages under `fixtures/`, then an e2e run over them.