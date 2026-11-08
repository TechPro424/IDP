# ADR 004: Spike A — Audio Capture

## Context
The extension must capture the audio of the playing video to estimate synthetic narration. Candidates: `createMediaElementSource`, `AudioWorklet`, `captureStream()`.

## Investigation
- **`createMediaElementSource`** — works on the watch page; the media element is fed by MSE `blob:` URLs, so the source is same-origin and the samples are not tainted. Simplest option, no extra permissions.
- **`AudioWorklet`** — `addModule()` with a `blob:` URL requires CSP allowances we do not want to grant. Locally-shipped worklet modules are possible but add a build artefact for no clear win.
- **`captureStream()`** — blocked or silent for EME/DRM content, and `tabCapture` would widen permissions to whole-tab audio.

## Decision
- Use `createMediaElementSource` from the `<video>` element.
- **One** `AudioContext` and **one** `MediaElementAudioSourceNode` per `<video>` element, cached in a `WeakMap` (`packages/extension/content.ts`). Creating a second source for the same element throws `InvalidStateError` — this was a real bug in the previous implementation.
- Connect the graph to `ctx.destination` so playback stays audible after the element is tapped.
- Sample with an `AnalyserNode` (`fftSize = 2048`), polling `getFloatTimeDomainData` every ~40 ms for `ANALYSIS_MS = 6000`. The previous `ScriptProcessor(4096, 1, 1)` is deprecated and runs on the main thread.
- A 500 ms silence guard that falls back to `AudioWorklet` was **proposed but is not implemented**; the code returns `null` when capture fails and the verdict then depends on the missing-modality policy.

## Status
- **Implemented:** `captureAudio()` in `packages/extension/content.ts`.
- **Not verified:** no automated test asserts non-silent samples on a real watch page.
- **Future work:** silence guard + worklet fallback; a fixture-driven capture test.