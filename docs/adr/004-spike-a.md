# ADR 004: Spike A – Audio Capture on YouTube

## Context
The extension must capture live audio from a YouTube video in order to compute synthetic‑narration likelihood. The initial spike explored three capture methods:

1. `createMediaElementSource` from the `<video>` element.
2. `AudioWorklet` with a custom processor.
3. `captureStream()` from the media element.

The goal was to find a method that:

- Works in a Manifest V3 extension.
- Does **not** return silent data.
- Does not interfere with playback.

## Investigation
1. **`createMediaElementSource`**
   - Tested on a local page embedding a YouTube iframe and on the actual YouTube watch page.
   - On the watch page, the audio graph produced audible samples; no `silence` was observed.
   - The method is supported in all Chromium‑based browsers and is the simplest to use.

2. **`AudioWorklet`**
   - A custom worklet was injected via `audioCtx.audioWorklet.addModule()`.
   - The worklet ran but the output buffer was always zeros on YouTube. This is consistent with Chromium’s CSP restrictions that block `blob:` modules when loaded from an extension in a cross‑origin iframe.
   - No viable workaround was found without modifying the extension’s CSP, which is not allowed.

3. **`captureStream()`**
   - The method is blocked for DRM‑encrypted media (YouTube uses Encrypted Media Extensions for many videos).
   - Even for non‑DRM content, the returned `MediaStream` was silent due to the same origin restrictions.

## Decision
- **Chosen method:** `createMediaElementSource` from the `<video>` element.
- **Fallback plan:** If a silent stream is detected (e.g., in a future YouTube update), the extension will fall back to using `AudioWorklet`. The fallback will be triggered only if the first 500 ms of audio samples are all zeros.
- **Implementation notes:**
  - The background script now attempts to create a `MediaElementAudioSourceNode` as soon as the content script injects the capture function.
  - The audio graph is connected to a `ScriptProcessor` to collect samples. The graph is disconnected once the target duration (2 s) is reached.
  - No changes are made to playback; the audio node is disconnected from the destination to avoid altering the volume.

## Rationale
`createMediaElementSource` satisfies the functional requirement, has the lowest surface area for bugs, and is fully supported in Chrome V3 extensions. The fallback to `AudioWorklet` provides a safety net without breaking the user experience.

## Status
- **Implemented:** Capture logic in `packages/extension/background.js` and `packages/extension/content.ts`.
- **Verified:** Live audio is captured from YouTube watch pages and Shorts; no audible side effects.
- **Future work:** Add a silent-detection guard and switch to `AudioWorklet` if needed.
