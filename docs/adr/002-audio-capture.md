# ADR 002: Audio Capture Strategy

**Context**
- The extension captures 2 s of audio from the current tab.
- Features are extracted client‑side to avoid sending raw audio.

**Decision**
- Use Chrome Tab Capture API (`chrome.tabCapture.capture`) with `{audio:true, video:false}`.
- Buffer 2 s via `AudioContext` and `ScriptProcessor`.
- After extraction, send `extractFeatures` result to background via `chrome.runtime.sendMessage`.
- Background acknowledges and may forward to edge worker.

**Rationale**
- Minimal permissions: only audio capture.
- 2 s is enough to capture speech patterns without heavy data.
- Client‑side extraction reduces bandwidth and preserves privacy.

**Status**
- Implemented in `packages/extension/background.js` and `content.ts`.  ✅
