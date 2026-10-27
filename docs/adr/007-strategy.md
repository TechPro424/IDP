# ADR 007: Minimal Viable Architecture Decision

## Context
After completing the feasibility spikes (audio capture, frame extraction, edge storage), the team must decide on the overall architecture to move forward with a production‑ready prototype.

## Decision
- **Audio Capture** – Use `createMediaElementSource` from the `<video>` element. If silent samples are detected, fallback to `AudioWorklet` after a 500 ms silence guard.
- **Frame Extraction** – Use a hidden `<canvas>` (preferably `OffscreenCanvas` if available). Capture frames at 4–8 fps, down‑sample to 64×36 grayscale, compute coarse histograms for visual features.
- **Ad Detection** – Observe the `ad-showing` class on `#movie_player` via a `MutationObserver`. Pause extraction during ads.
- **Shorts Detection** – Parse `/shorts/` URLs and listen for `yt-navigate-finish` to re‑initialize extraction on SPA navigation.
- **Edge Storage** – Use Cloudflare Workers KV with `cacheTtl=60` for durability and reasonable latency (~5 ms warm read). Cache API is reserved for hot keys if needed.
- **Bloom Filter** – Store in KV; persist on POST. Serve via `/v1/bucket/{prefix}`. Pad responses to a fixed entry count (32) to hide occupancy.
- **Client‑Side Scoring** – Run all feature extraction and scoring in the extension. No data is sent to the edge except the Bloom‑positive prefix and a lightweight Bloom POST to confirm the verdict.
- **Privacy** – No telemetry, no third‑party code, minimal permissions. Store only the Bloom filter and local cache.
- **UI** – Popup with enable toggle, prefix input, Add & Bloom buttons. On‑screen overlay shows slop indicator, “Show anyway”, and per‑dimension explanations. Options page for thresholds, allowlist, delete data.

## Rationale
- The chosen components are the simplest that satisfy the functional and privacy requirements while keeping the codebase minimal.
- Workers KV provides durable, low‑latency storage without external dependencies.
- Hidden canvas extraction is lightweight and works across browsers.
- Using the `ad-showing` class ensures ads are not mis‑classified.
- The architecture keeps all heavy processing on the client, aligning with the opt‑in, local‑first guardrails.

## Status
- **Implemented** – All chosen components are in the codebase.
- **Verified** – Unit tests, Playwright tests, and performance benchmarks confirm the expected behavior.
- **Future work** – Monitor real‑world latency, refine ad‑detection heuristics, and expand the feature dictionary.
