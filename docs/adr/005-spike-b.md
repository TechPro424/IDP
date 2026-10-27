# ADR 005: Spike B – Frame Extraction, Shorts Behavior & Ad Detection

## Context
The extension must identify short‑form YouTube content (Shorts) and avoid analyzing pre‑loaded neighboring videos. It also needs to pause analysis during ads to avoid false positives.

## Investigation
1. **Frame Extraction**
   - A hidden `<canvas>` is used with `OffscreenCanvas` where available. On browsers that do not support it, we fall back to a standard `<canvas>` appended to the DOM but hidden with `display:none`.
   - Frames are captured at ~4–8 fps by drawing the current `<video>` frame to the canvas and extracting the pixel data. The data is then down‑sampled to 64×36 grayscale and a coarse 3‑channel histogram. This matches the visual feature pipeline in `packages/features/src/visual.ts`.
   - The canvas is created once per `<video>` element and reused. We store the element in a `Map` keyed by the element’s `id` to avoid recreating on every navigation.

2. **Shorts Detection**
   - Shorts URLs match `/shorts/([a-zA-Z0-9_-]+)`. We extract the videoId from the URL pathname. If the pathname starts with `/shorts/`, we mark the page as a Short.
   - YouTube’s SPA navigation emits a `yt-navigate-finish` event. We listen for this event and re‑initialize the canvas and feature extraction when it occurs.

3. **Ad Detection**
   - During playback, the player container (`#movie_player`) receives the class `ad-showing` when an ad is playing. We monitor this class via a `MutationObserver`. When an ad is detected, we pause the feature extraction loop and resume when the class disappears.
   - As a fallback, we check for the presence of the `ytp-ad-skip-button` button. If it appears, we consider an ad to be in progress.

## Decision
- **Frame extraction** will use the hidden `<canvas>` approach with `OffscreenCanvas` if available, otherwise a standard hidden canvas.
- **Shorts detection** will parse the URL pathname and re‑initialize on `yt-navigate-finish` events.
- **Ad detection** will rely on the `ad-showing` class via a `MutationObserver`; fallback to button detection.
- The extension will maintain a per‑video state object that tracks whether it is currently in an ad or in a Short. Feature extraction runs only when not in an ad.

## Rationale
- The hidden canvas approach is lightweight and works in all Chromium‑based browsers. `OffscreenCanvas` provides better performance but is not mandatory.
- Relying on the `ad-showing` class is the most reliable indicator of ads, as it is injected by YouTube’s player code. The fallback to button detection protects against potential CSP or DOM changes.

## Status
- Implemented in `packages/extension/content.ts` and `packages/extension/background.js`. The content script now creates the hidden canvas, extracts frames, and listens for Shorts navigation and ad changes.
- Playwright tests in `packages/extension/tests/e2e.spec.ts` cover the ad‑detection logic by mocking the presence of the `ad-showing` class.
- Future work: refine the frame‑sampling rate and validate the Short detection logic on real YouTube pages.
