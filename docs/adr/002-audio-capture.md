# ADR 002: Audio Capture Strategy

Superseded in detail by ADR 004; kept because the permission trade-off is what matters here.

## Context
The extension needs the audio of the playing video, and nothing else. Two families of
options exist: capture the tab (broad) or tap the media element (narrow).

## Decision
- **Tap the `<video>` element** with `createMediaElementSource` — no `tabCapture` permission,
  no whole-tab audio, no microphone.
- Sample 6 s (`ANALYSIS_MS = 6000`), not 2 s: `minSpeechSeconds = 5` has to fit inside the
  window or every quiet video reports `missing`.
- Buffer frames from an `AnalyserNode` (`fftSize = 2048`), **not** a `ScriptProcessor`
  (deprecated, main thread, and it was the source of a double-`connect` crash).
- Extract features in the content script and send only the resulting numbers to the service
  worker via `chrome.runtime.sendMessage({type:'scoreVideo'})`. Raw samples never leave the
  content script.

## Rejected
- `chrome.tabCapture.capture({audio:true})` — needs the `tabCapture` permission for audio the
  user did not ask us to hear (oversight of everything else in the tab), and requires a
  user-gesture stream id that MV3 workers handle awkwardly.
- `getUserMedia` — loops back system or microphone audio, wrong source and worse privacy.
- `captureStream()` — silent for EME/DRM media.

## Consequences
- If the element is silent (CORS-tainted, DRM, or a future player change) capture fails; the
  verdict then follows `missingModalityPolicy` rather than pretending to have data.
- Playback is preserved because the source node is connected to `ctx.destination`.

## Status
- **Implemented** — `captureAudio()` in `packages/extension/content.ts`.
- **Not verified on a live page by an automated test**; see ADR 004.
