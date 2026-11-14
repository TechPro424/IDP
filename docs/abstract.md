# Slop Filter

**Status: research prototype. Advisory only. No accuracy claim is made.**

Slop Filter is a browser extension that estimates whether a video's narration is
synthetic and whether the content is substantively empty, then shows the viewer an
advisory overlay they can dismiss in one click. All processing happens on the device:
audio is sampled from the media element, reduced to spectral/pitch/pause statistics and
discarded; frames are reduced to 64×36 grayscale statistics; captions to a handful of
lexical statistics.

Scoring is deliberately transparent and deliberately weak: `S` (synthetic narration) is
currently a continuity-of-speech proxy, `Hatt` a cut-rate proxy, `Hsub` a lexical-diversity
proxy. They fuse as `min(S, H)` with `H = mean(Hatt, Hsub)`; a verdict is BLOCK only when
both thresholds are exceeded, REVIEW inside a ±0.1 gray band, ALLOW otherwise. A logistic
prior model exists in `packages/scoring/src/model.ts` but is not fitted to any data — it is
a placeholder with a version string, and it says so.

The only network path is opt-in and prefix-only: a SHA-256 hash of the canonical watch URL,
truncated to 5 hex characters (20 bits), is checked against a Bloom filter plus a padded
bucket in a Cloudflare Worker. A Bloom-negative video produces no request at all. With no
edge origin configured — the default — the extension makes no network requests whatsoever.

What exists: a shared browser/Node feature library with a parity golden file, a scoring
library with fusion ablations and a gray-band decision rule, a Bloom filter with a versioned
binary format, a Hono edge worker with a padded bucket protocol, and an MV3 extension with
consent gating, a closed-Shadow-DOM overlay, local caching, and one-click deletion of all
local data.

What does not exist, and is not simulated: a labelled dataset, annotation agreement
statistics, a calibrated model, any measured accuracy or latency, and any robustness
evaluation. `CHECKLIST.md` records the state of every planned item; `docs/rubric/` describes
the rubric that must be validated before any of the above becomes possible.