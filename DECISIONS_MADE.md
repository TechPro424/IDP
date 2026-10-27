# Decisions Made During Project

| Decision | How it was made | Why it was made | Objective |
|---|---|---|---|
| Audio capture mechanism – use `createMediaElementSource` with `AudioWorklet` fallback | Implemented in the extension’s audio‑capture module, added 500 ms silence guard to trigger fallback | Simplest reliable capture on YouTube, no extra permissions | Capture consistent audio for feature extraction |
| Frame extraction – hidden `<canvas>` (or `OffscreenCanvas` if available) to grab frames at 4–8 fps, down‑sample to 64×36 grayscale | Added in the visual‑feature module using `requestAnimationFrame` and `drawImage` | Lightweight, cross‑browser, no external libs | Obtain visual features with minimal overhead |
| Ad detection – observe `ad‑showing` class on `#movie_player` via `MutationObserver` | Observer added in the extension; pauses extraction during ads | Avoid mis‑classifying ads as content | Accurate ad detection |
| Shorts detection – parse `/shorts/` URLs and listen for `yt‑navigate‑finish` to re‑init extraction | Implemented in the navigation handler | Handle SPA navigation on YouTube Shorts | Correctly restart extraction on Shorts |
| Edge storage choice – Cloudflare Workers KV with `cacheTtl=60` for durability & ~5 ms warm reads | Decided after benchmarking Workers KV vs Cache API vs Upstash | Low latency, durable storage, no external deps | Store Bloom filter & prefix data efficiently |
| Bloom filter persistence – store in KV; expose via `/v1/bucket/{prefix}`, pad responses to 32 entries | Added in the KV handler module | Hide occupancy, keep API simple | Provide deterministic Bloom lookup |
| Client‑side scoring – all feature extraction & scoring run in the extension; only Bloom‑positive prefix sent to edge | Implemented in the scoring module | Keeps data local, preserves privacy | Minimize data sent, reduce latency |
| Privacy stance – no telemetry, minimal permissions, only Bloom filter & local cache | Documented in ADR 007 | Meet privacy‑first requirement | Avoid user‑data exposure |
| UI design – popup toggle, prefix input, Add/Bloom buttons; overlay shows slop indicator, “Show anyway”, per‑dimension explanation; options page for thresholds, allowlist, delete data | Designed in the extension UI module | Provide user control & transparency | Enable user opt‑in and configuration |
| Node‑CLI script for feature extraction – `packages/features/scripts/cli.ts` that reads a WAV, runs `extractFeatures`, outputs JSON | Created from scratch, added to repo | Facilitate testing & integration with Python pipelines | Quick, cross‑platform CLI for feature extraction |
| Cross‑platform binary format for large feature sets – optional binary export in CLI | Added to CLI script (commented for future) | Reduce I/O when handling many features | Efficient storage/transfer of feature data |
| Strategy decision completion – marked in `NEXT_STEPS.md` that all strategy decisions are made, moving to Phase 1 | Updated status table and next‑step list | Ensure clear project roadmap | Align team on next deliverables |
