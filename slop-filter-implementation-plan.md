# Implementation Plan: Automated External Filter for Low-Quality YouTube Synthetic Media

> **Audience:** an autonomous coding agent (and the human student supervising it).

---

## 1. Project summary

### 1.1 Goal
Build and evaluate a **user-controlled, opt-in, platform-external browser filter** that estimates whether a YouTube video is **synthetic-narrated slop**. The estimate runs **locally in the user's browser**, on media the user is already playing. An optional edge service shares precomputed verdicts through a privacy-preserving prefix lookup.

### 1.2 Definition of "slop" (project's operational definition)
Content that actively harms people's attention span and critical thinking.

**Evidence caveat (must appear in the final report):** the supporting literature is mostly correlational and self-reported, concentrates on short-form video, links cognitive effects more to compulsive use than to content features, says little about reasoning, and (as far as research found) contains nothing specific to AI-generated content. The system therefore estimates a **risk proxy**. It never claims to measure harm.

### 1.3 Scope decisions (fixed)
| Decision | Value |
|---|---|
| Target logic | **Intersection (Option A):** flag only when *synthetic narration* AND *attention-harm proxies* are both high |
| "Synthetic" means | **Synthetic narration (voice) only.** No AI-generated-visuals detector in v1 |
| Primary content type | **YouTube Shorts first**, then standard watch pages as a stretch |
| Epistemic reliability (fact-checking) | **Out of scope for v1** (rubric may annotate it exploratorily) |
| Human-made slop | **Deliberately not flagged.** State as a scope limit |
| Contribution/upload path | **Removed from v1** (see §2) |
| Release | Private academic prototype (unpacked extension), not a public store listing |

### 1.4 Research questions
1. Can cheap, on-device audio, visual-pacing and text-repetition features separate synthetic-narrated slop from the other three quadrants (synthetic non-slop, human slop, human non-slop)?
2. How well do these features generalize to unseen TTS systems, speakers, and codecs?
3. Does AND-style intersection outperform learned or weighted fusion?
4. Can a short-prefix lookup plus Bloom pre-filter deliver verdicts with low latency and a quantified anonymity set?

---

## 2. Guardrails (hard rules for the agent)

**Stop and ask the human if any task would violate these.**

1. **Opt-in and local-first.** The extension does nothing until the user explicitly enables it. All scoring happens on-device. Provide a one-click "pause" and "delete all local data".
2. **No contribution/upload path in v1.** The extension never uploads feature vectors or watch history. The only network call is the prefix lookup (§7.3), made only on a Bloom-filter positive.
3. **Annotation mode is local-only.** Ratings and features are stored in the browser and exported manually by the annotator as a JSON file after consent. No automatic transmission.
4. **No telemetry, analytics, or remote code.** No third-party scripts. Manifest V3 forbids remotely hosted code anyway.
5. **Minimal permissions.** Host permissions only for `https://www.youtube.com/*` and the edge-service origin. Only the `storage` permission (plus what the spikes prove necessary, each justified in an ADR).
6. **Soft UI only.** Flagged videos get a dismissible overlay with "Show anyway", an explanation of the scores, and user-adjustable thresholds. Never prevent playback.
7. **Advisory wording.** Verdict text says "likely" / "estimated". Never state that a creator used AI or that a video harms viewers.
8. **Do not use YouTube's name, logo, or trademarks** in the extension's name, icon, or UI.
9. **CI never touches youtube.com.** Use local fixtures and mock pages.
10. **Log assumptions.** Record any assumption in `docs/decisions/` as a short ADR.

---

## 3. Core definitions

### 3.1 Sub-scores (each in [0, 1], plus a `missing` flag)
| Symbol | Name | Meaning | Primary inputs |
|---|---|---|---|
| `S` | Synthetic-narration likelihood | Probability the narration is synthetic speech | Audio features |
| `Hatt` | Attention-fragmentation proxy | Rapid, repetitive stimulus change | Cut rate, ASI stats, pacing, audio pacing |
| `Hsub` | Substance-deficit proxy | Low informational variety and high repetition | Text repetition, static-frame ratio, loop indicators |
| `H` | Harm proxy | Fusion of `Hatt` and `Hsub` | Learned or weighted |

### 3.2 Composite and verdict
- **Slop Risk Score (SRS)** = fusion of `S` and `H`. Compare these variants in ablations: `min(S,H)`, `S*H`, noisy-AND, and logistic regression on `[S, H, S*H]`.
- **Verdict states:** `ALLOW`, `REVIEW`, `BLOCK`.
  - `BLOCK` if `S >= tau_s` AND `H >= tau_h`.
  - `REVIEW` if exactly one is high and the other is missing (for example, no speech), or SRS lies in a configurable gray band.
  - `ALLOW` otherwise.
- **Missing-modality policy (default):** no detectable speech → `S` missing → never `BLOCK`; at most `REVIEW`. Document the policy and make it configurable.
- Naming: avoid the acronym "ASI" for anything but **Average Shot Interval**. The composite is **SRS**.

---

## 4. Architecture

```
┌──────────────────── USER'S BROWSER (opt-in MV3 extension) ────────────────────┐
│ Navigation/DOM observer → videoId (watch + Shorts)                           │
│        │                                                                      │
│        ├─► local verdict cache (IndexedDB/chrome.storage, TTL, model version) │
│        ├─► Bloom filter (known BLOCK/REVIEW hashes, downloaded as a binary)   │
│        │     ├─ definitely absent → NO network call → local scoring           │
│        │     └─ possibly present  → prefix lookup to edge (confirm)           │
│        ▼                                                                      │
│ Local analyzer (media the user is already playing; nothing leaves device)     │
│  • Audio: AnalyserNode (primary) / AudioWorklet (only if spike passes)        │
│  • Frames: downsampled canvas sampling in a Web Worker → shot boundaries      │
│  • Text (optional): visible title/captions → repetition & entropy             │
│  → S, Hatt, Hsub → SRS → verdict                                             │
│ UI: overlay + "Show anyway" + per-dimension explanation + thresholds          │
│ Annotation mode (consented annotators): rubric form → local JSON export       │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ only on Bloom positive: GET /v1/bucket/{hashPrefix}
                ▼
┌─ Edge: Cloudflare Worker (Hono, TypeScript) ──────────────────────────────────┐
│ prefix → padded bucket {suffix → verdict}; no cookies, no auth, no logging    │
│ Storage under test: Workers KV vs Cache API vs Upstash Redis (benchmark)      │
└───────────────▲───────────────────────────────────────────────────────────────┘
                │ publish (offline, manual)
┌─ Research harness (lab only, Python + Node) ──────────────────────────────────┐
│ Licensed/self-generated media → shared TS feature code (Node CLI) → features  │
│ + annotation exports → training, calibration, ablations, evaluation           │
│ Verdict seeding: researcher-curated list of annotated IDs → edge store        │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Design notes**
- The Bloom filter is a **privacy and latency win**: for videos that are definitely absent, no request is made at all. Only possible positives query the edge, and they send only a short hash prefix.
- **v1 honesty:** with no contribution path, the edge store holds only researcher-seeded verdicts. It exists to evaluate the lookup design and latency; the main product path is local scoring. The cold-start limitation is reported, not hidden.
- Keep a single source of truth for feature extraction: a **shared TypeScript library** used by both the extension and a Node CLI. Python consumes its output. This removes Python/JS feature drift.

---

## 5. Tech stack

Pin all versions in lockfiles. Where a choice is unverified it is marked *(verify)*.

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces; Python via `uv` | Single repo, two toolchains |
| Language (client/edge) | TypeScript (strict) | Shared types across packages |
| Extension framework | Manifest V3, Vite-based build with **WXT** (fallback: Vite + `@crxjs/vite-plugin`) *(verify)* | Chromium first; Firefox is out of scope |
| UI | Preact or vanilla TS + CSS (Shadow DOM for the overlay) | Keep bundle small; Shadow DOM avoids page CSS clashes |
| Audio features | Web Audio `AnalyserNode` in content script; **Meyda** for spectral features *(verify feature coverage)*; own YIN pitch + jitter | `AudioWorklet` only if Spike A passes |
| Frame analysis | Hidden `<canvas>` downsample (e.g. 64×36 grayscale + coarse color histogram) in a Web Worker via `OffscreenCanvas`/`ImageBitmap` | Sample at 4–8 fps |
| Text features | Pure TS: token entropy, type-token ratio, repeated n-gram ratio, gzip-ratio proxy | No on-device LLM in v1 |
| On-device model | JSON coefficients (logistic regression) first; **ONNX Runtime Web** (WASM) only if a tree/NN model is needed *(verify export path)* | Keep inference <50 ms |
| Local storage | `chrome.storage.local` (settings) + IndexedDB (verdict cache, annotation records) | TTL + model-version keys |
| Hashing | WebCrypto `SHA-256` | Prefix/suffix split (§7.3) |
| Bloom filter | Small in-house implementation (double hashing from SHA-256 bytes) + unit tests | Avoid extra dependencies |
| Edge | Cloudflare Workers + **Hono**; `wrangler`; Vitest with the Workers pool for tests | Storage choice by benchmark |
| Edge storage candidates | Workers KV (with `cacheTtl`), Cache API, Upstash Redis REST | See Spike C |
| Research harness | Python 3.12, PyTorch, torchaudio/librosa, scikit-learn, LightGBM/XGBoost, pandas, PySceneDetect (for cross-checking cut detection), Hydra configs, MLflow (local) | PyTorch only where a learned audio baseline is trained |
| Media prep (lab) | `ffmpeg` to decode licensed/self-generated media to PCM and downsampled frames for the Node CLI | Never used on YouTube media |
| Annotation | **Label Studio** (local) for lab-media items; extension annotation mode for YouTube items | Rubric in §9.2 |
| Agreement stats | scikit-learn (Cohen's κ), `krippendorff` package | |
| E2E testing | Playwright loading the unpacked extension against **local mock pages** | Never YouTube |
| Lint/format/CI | ESLint, Prettier, `tsc --noEmit`, Ruff, pytest, GitHub Actions | CI has no network access to YouTube |

**TTS candidates for self-generated and held-out generator splits** (license check mandatory, §9.1): at least 4 distinct systems from different families (for example, an open-source neural TTS, a diffusion/flow-based TTS, a commercial API if its terms allow detector-training use, and an older concatenative or formant system). Reserve ≥2 generators for test only.

---

## 6. Repository layout

```
/
├─ README.md
├─ docs/
│  ├─ compliance/        licenses.md, privacy-notice.md, data-flow.md
│  ├─ decisions/         ADR-0001-*.md …
│  ├─ spikes/            spike-a-audio.md, spike-b-frames-shorts.md, spike-c-edge.md
│  ├─ rubric/            annotation-rubric.md, adjudication.md
│  ├─ threat-model.md
│  └─ report/            figures/, report.md
├─ packages/
│  ├─ features/          shared TS: audio, visual, text feature code + config + CLI
│  ├─ scoring/           TS: sub-score models, fusion, thresholds, calibration loader
│  ├─ bloom/             TS: Bloom filter + tests + binary format
│  ├─ extension/         MV3 extension (content, worker, overlay UI, options, annotation mode)
│  └─ edge/              Cloudflare Worker (Hono), wrangler.toml, tests, benchmark scripts
├─ research/
│  ├─ pyproject.toml
│  ├─ configs/           Hydra configs (splits, models, augmentations)
│  ├─ data/              (gitignored) raw/, features/, annotations/
│  ├─ src/               loaders, augmentation, training, calibration, evaluation
│  └─ notebooks/         exploratory only
├─ fixtures/             local mock YouTube-like pages, small licensed test clips
└─ .github/workflows/
```

---

## 7. Technical specifications

### 7.1 Feature extraction (shared `packages/features`)
One config file (`features.config.json`) defines every parameter and is consumed by both browser and Node runs.

**Audio** (analysis at the AudioContext rate, 44.1 or 48 kHz; lab audio is resampled to 48 kHz to match; frame ≈ 2048, hop ≈ 512)
- Energy-based voice-activity detection → speech frames only.
- Spectral flatness: mean and variance over speech frames.
- Spectral centroid: variance.
- Pitch (YIN) contour: variance, mean absolute delta, voiced ratio.
- Jitter (local, from period estimates). **Do not use shimmer** (reported as non-discriminative).
- Pause statistics: mean and variance of inter-speech pause durations (TTS pauses tend to be regular).
- Loudness dynamic range.
- `speech_ratio`, `music_suspected` heuristic, `n_speech_seconds`.
- Output includes `missing` if speech seconds < `MIN_SPEECH_SECONDS` (default 5).

**Visual**
- Sample 4–8 fps, downsample to 64×36 grayscale plus a coarse color histogram.
- Shot boundary = histogram/frame-difference above an adaptive threshold with a minimum shot length.
- Features: cuts per minute, **Average Shot Interval** mean and coefficient of variation, mean inter-frame difference, static-frame ratio (slideshow indicator).
- Cross-check Node cut detection against PySceneDetect on lab clips.

**Text** (from visible DOM title and captions only; `missing` if unavailable)
- Token entropy, type-token ratio, repeated 3-gram ratio, gzip compression ratio, sentence-length variance.

**Parity requirement:** a golden-file test suite runs the same fixtures through the browser build (headless) and the Node CLI and asserts feature agreement within tolerance. Canvas scaling differs slightly from ffmpeg scaling, so calibrate visual thresholds on browser-collected data.

### 7.2 Local analysis state machine
`IDLE → OBSERVED(videoId) → CACHE_CHECK → [BLOOM_CHECK → (EDGE_CONFIRM)] → SCORING(window) → VERDICT → UI`
- Re-initialize on SPA navigation. YouTube reuses the same `<video>` element, and `createMediaElementSource` can be called only once per element, so keep a per-element singleton and tear down cleanly.
- Connect the audio graph to `destination` or playback goes silent.
- Pause scoring while an ad is showing (ad state detection must be spiked; the player container is believed to carry an `ad-showing` class *(verify)*).
- Shorts: scoring starts after `MIN_SPEECH_SECONDS` of speech or at video end, and the overlay is applied **retroactively** if the user is still on the video. Do not analyze neighboring preloaded videos; analyze only the video actually playing (Spike B must confirm how to tell).
- Never block rendering of the page. All heavy work is off the main thread where possible.

### 7.3 Edge protocol: Bloom pre-filter and prefix lookup
**Hashing:** `h = SHA-256(utf8(videoId))` as lowercase hex. `prefix = h[0:P]`, `suffix = h[P:P+Q]`. Defaults `P=5` (20 bits), `Q=11`; both configurable. **Hashing alone provides no anonymity** (public IDs can be hashed and matched); the protection comes from truncation plus bucketed, padded responses.

**Bloom filter**
- Contains hashes of videos with verdict `BLOCK` or `REVIEW`.
- Sizing: `m = -n·ln(p) / (ln2)²`, `k = (m/n)·ln2`. At `p = 0.001` that is ≈14.4 bits/element and k≈10 (n = 10,000 → ≈18 KB).
- A positive is only "possibly present". **Never hide a video on a Bloom hit alone**; confirm via the bucket lookup. A confirmed miss is cached as `ALLOW` for the TTL.
- Delivered as a versioned binary (`GET /v1/bloom/latest`, same for every client, long cache).

**Bucket API**
```
GET /v1/bucket/{prefix}        (prefix = P lowercase hex chars)
200 application/json
{
  "v": 1,                       // schema version
  "mv": "model-2026-11-01",     // model/verdict-set version
  "p": 5, "q": 11,
  "entries": [ { "s": "<suffix hex>", "d": 1|2, "c": 0-100 }, ... ],  // d: 1=BLOCK, 2=REVIEW; c: quantized SRS
  "pad": true
}
```
- Pad every response to a fixed entry count (default 32) with random dummy suffixes so size does not leak bucket occupancy.
- Headers: `Cache-Control: public, max-age=3600`, no `Set-Cookie`, strict CORS (extension origin only), no request-body or identifier handling.
- No application-level logging of requests. (Cloudflare itself may keep edge logs; disclose this in the privacy notice.)
- Rate limiting via Cloudflare rules, not stored per-user state.
- **Storage note (from research):** Workers KV is eventually consistent (writes can take about a minute to propagate) and cold reads are slower; claimed read latencies come from secondary sources. Treat all latency numbers as hypotheses until Spike C measures them.

### 7.4 Extension UX requirements
- First-run consent screen (plain language, links to `privacy-notice.md`), explicit enable toggle.
- Overlay: blur or dim with message "This video looks like synthetic-narrated, attention-fragmenting content (estimate)", **Show anyway**, **Why?** (shows `S`, `Hatt`, `Hsub` with short explanations), **Not slop / It is slop** (local-only feedback for the user's own allowlist, never uploaded).
- Options page: sensitivity slider (maps to `tau_s`, `tau_h`), allowlist/denylist, missing-modality policy, **Delete all local data**, annotation-mode toggle.
- Accessibility: keyboard operable, ARIA labels, respects reduced motion and high contrast.

---

## 8. Threat model (summary; full version in `docs/threat-model.md`)
| Threat | Mitigation in v1 |
|---|---|
| Viewing-history leakage via lookup | Bloom pre-filter (most videos never queried), short prefix, padded buckets, no identifiers, no app logs; quantify residual risk |
| Query-sequence profiling by IP | Documented residual risk; relay (e.g. Oblivious HTTP) listed as future work |
| Poisoning/Sybil | Not applicable in v1 because no uploads; revisit before adding any contribution path |
| Malicious bucket data causing wrongful overlays | Soft UI, signed verdict-set manifests (optional), client confirms Bloom hit before acting |
| Creator reputational harm | Advisory wording, no public blocklists, dispute channel documented |
| Evasion by producers | Adversarial robustness tests (§9.5) and honest limitation statement |
| Extension compromise | Minimal permissions, no remote code, dependency audit, reproducible builds |

---

## 9. Data, annotation and evaluation

### 9.1 Data sources and license audit
1. **Self-generated synthetic narration** (you own the outputs; check each tool's terms).
2. **Human narration** from openly licensed sources, plus public speech-spoofing datasets, each with a recorded license.
3. **YouTube in-the-wild items: annotation mode only.** Consenting annotators watch videos in their own browsers; the extension records feature vectors, rubric ratings, and the video ID; the annotator exports JSON manually. No media is ever saved.
4. Record in `docs/compliance/licenses.md`: dataset, URL, license, allowed uses, redistribution limits, retention rule.

**Test-set principle:** the final test set is browser-collected annotation data (closest to deployment), held out entirely from training and threshold tuning.

### 9.2 Annotation rubric (draft; finalize in `docs/rubric/`)
Rate each item (1–5 with written anchors), annotators work independently:
1. **Attention fragmentation:** rapid, repetitive, hook-driven stimulus change (1 = calm, sustained; 5 = relentless).
2. **Cognitive substance:** informational, creative, or narrative value (1 = substantive; 5 = empty filler).
3. **Narration origin:** human / synthetic / mixed / unsure, plus confidence (in-the-wild ground truth is inherently noisy; report this).
4. **Epistemic reliability (exploratory only):** misleading or unsupported claims. Not used for the v1 label.

**Derived labels:** `harm_proxy_label` = high if dimensions 1 and 2 are both ≥ a threshold set *before* seeing results. `slop_label` = `synthetic` AND `harm_proxy_label`. Adjudicate disagreements with a third rater.

**Quadrant targets (adjust to feasibility):** minimum ~100 items per quadrant (synthetic-slop, synthetic-non-slop, human-slop, human-non-slop); stretch ~250. The two mixed quadrants are the hard negatives and matter most for false positives. Report per-dimension agreement (Cohen's κ pairwise, Krippendorff's α overall). If agreement is poor, revise anchors and re-train annotators before modeling.

### 9.3 Models and fusion
1. **Heuristic baseline:** hand-set thresholds on the features above.
2. **Learned baselines:** logistic regression, then gradient boosting, on features. Calibrate with isotonic or Platt scaling. Report expected calibration error.
3. **Optional learned audio detector** (PyTorch, small CNN or a pretrained speech-embedding classifier) trained in the lab as an upper-bound comparison; deploy on-device only if it stays small enough.
4. **Fusion ablation:** AND with thresholds, `min`, product, noisy-AND, learned logistic with interaction.
5. Choose thresholds on validation data only. Export final models as JSON/ONNX with a version string.

### 9.4 Splits
- Generator-disjoint and speaker-disjoint (leave-one-generator-out, leave-speaker-out).
- Train/validation/test never share a video ID, channel, or speaker.
- Fix random seeds and log everything to MLflow.

### 9.5 Evaluation protocol
- **Detection:** per-quadrant precision/recall/F1, AUROC, PR-AUC, with bootstrap confidence intervals. Headline numbers are on the browser-collected test set.
- **False positives on hard negatives:** fast-paced educational content, accessibility narration, screencasts, assistive-voice users, non-native speakers.
- **Generalization:** unseen generators and unseen speakers (report the drop vs. in-domain).
- **Robustness:** codec re-encoding (AAC/Opus at several bitrates), noise, background music at several SNRs, speed changes, music-only/no-speech videos (verify the missing-modality policy behaves as specified).
- **Ablations:** feature groups (audio, visual, text), each sub-score, fusion variants, with and without the disclosure label as a *separate* analysis feature (creator-reported and incomplete, so never a ground truth).
- **Fairness slices:** by language and accent where the data allows. State limits plainly.
- **Latency:** client scoring time (p50/p95) and CPU cost; edge response time (p50/p95 from several regions) for KV vs Cache API vs Upstash; end-to-end time to verdict for Shorts.
- **Anonymity set:** report as a function of prefix length and an *assumed* catalog size (state the assumption; do not claim a measured catalog size). Include query-sequence linkage as a qualitative residual risk.
- Error analysis with example categories (no media stored; describe by feature profile only).

---

## 10. Phased implementation plan

Relative durations assume one student plus an agent; scale to your deadline.

### Phase 0: Feasibility spikes (≈1–1.5 weeks) — **go/no-go gate**
Each spike produces a short report in `docs/spikes/` and an ADR.

**Spike A: Audio capture on youtube.com**
- Try, in order: `createMediaElementSource` + `AnalyserNode`; `AudioWorklet`; `captureStream()`.
- Known risks from research (verify each yourself):
  - `MediaElementAudioSourceNode` outputs **silence** when the media is CORS-restricted. An open-source extension reported it works on youtube.com but not on a different-origin player.
  - YouTube's Content Security Policy blocked `AudioWorklet` loading via `blob:` URLs in another extension's experiment, which led that project to abandon the worklet. Test loading the worklet from an extension-packaged URL.
  - `captureStream()` is reported blocked on DRM-encrypted media.
  - Calling `createMediaElementSource` re-routes the element's audio; failing to connect to `destination` mutes playback.
- **Acceptance:** a documented method that yields non-silent samples on normal watch pages and Shorts without audible side effects, or a documented decision to reduce scope (for example, audio-free pacing features only).

**Spike B: Frames, IDs, Shorts behavior**
- Can a hidden canvas read frames without tainting? Cost per sample at 4–8 fps?
- Reliable videoId extraction for `/shorts/{id}` and `/watch?v={id}`, including SPA navigation (the `yt-navigate-finish` event is believed to exist *(verify)*).
- Does the Shorts feed preload neighboring videos, and how do we guarantee we analyze only the playing one?
- How do we detect ads and pause scoring?
- **Acceptance:** written findings plus a working fixture-based prototype.

**Spike C: Edge storage benchmark**
- Implement the bucket endpoint on three back-ends (KV with high `cacheTtl`, Cache API, Upstash). Measure cold and warm p50/p95 from at least 3 regions.
- **Acceptance:** a table with measured numbers and a choice recorded in an ADR. The 15 ms target remains a hypothesis until measured.

**Gate:** if Spike A fails entirely, reduce scope to visual/text proxies plus lab-only audio detection and update the abstract before continuing.

### Phase 1: Scaffolding (≈0.5 week)
- Monorepo, TS strict config, lint/format, CI (no YouTube access), Hydra/uv setup, ADR template, `fixtures/` mock pages.
- **Done when:** CI is green on an empty-but-wired pipeline and `README` explains the guardrails.

### Phase 2: Shared feature library (≈2 weeks)
- Implement audio, visual, text features in `packages/features` with `features.config.json`.
- Node CLI: decode lab media with ffmpeg → features → Parquet/CSV for Python.
- Golden-file parity tests (browser headless vs Node), PySceneDetect cross-check.
- **Done when:** feature unit tests and parity tests pass; documented feature dictionary exists.

### Phase 3: Research harness and datasets (≈2 weeks, overlaps Phase 2)
- License audit complete. Self-generate synthetic clips from ≥4 TTS families. Assemble human-narration sets.
- Augmentation pipeline (codec, noise, music, speed). Split generator-by-generator.
- Baselines: heuristic and logistic regression on lab data.
- **Done when:** reproducible `make data` / `make baseline` produce tracked MLflow runs.

### Phase 4: Rubric and annotation (≈2 weeks, parallel)
- Finalize rubric and adjudication guide. Build annotation mode in the extension (local rating form, JSON export, consent screen). Pilot with 2–3 annotators on ~30 items; compute κ; revise anchors.
- Run the full annotation round toward quadrant targets.
- **Done when:** agreement is reported and the test set is frozen.

### Phase 5: Modeling and calibration (≈2 weeks)
- Train sub-score models and fusion variants on lab + annotation-train data. Calibrate. Select thresholds on validation only. Run ablations and generalization tests.
- Export versioned models for the extension.
- **Done when:** a results table exists for every evaluation in §9.5 that applies to modeling, with confidence intervals.

### Phase 6: Extension MVP (≈2.5 weeks)
- Observer/state machine, local analyzer, scoring, cache, overlay UI, options page, consent flow, delete-data, annotation mode polish.
- Playwright E2E against mock pages; performance budget (main-thread impact, CPU).
- **Done when:** the extension scores fixture videos end to end, the overlay and "Show anyway" work, and no network call occurs except the permitted prefix lookup.

### Phase 7: Edge service and Bloom pipeline (≈1.5 weeks)
- Implement `/v1/bucket/{prefix}` and `/v1/bloom/latest`; padding; headers; CORS; rate limits; seed script from researcher-curated verdicts.
- Client integration: Bloom check → confirm → cache. Benchmark and anonymity-set analysis scripts.
- **Done when:** latency and anonymity tables are produced and the privacy notice matches actual behavior.

### Phase 8: Evaluation and reporting (≈2 weeks)
- Run the full protocol (§9.5), produce figures, error analysis, limitations (cold start, Shorts timing, human-made slop not flagged, evidence caveats).
- Update the abstract to match what was actually built and measured.

### Phase 9: Documentation and handoff (≈1 week)
- Final threat model, data-flow diagram, privacy notice, reproducibility guide, and a demo script.

---

## 11. Testing strategy
- **Unit:** features (synthetic signals with known spectra and cut points), Bloom filter (FPR within tolerance), hashing/prefix logic, scoring and thresholds, state machine.
- **Property tests:** Bloom has no false negatives; padded buckets have constant size.
- **Parity:** browser vs Node features within tolerance on shared fixtures.
- **Integration:** extension ↔ mock edge; storage TTL and versioning.
- **E2E:** Playwright with the unpacked extension on local mock pages that imitate Shorts and watch layouts.
- **Manual QA on real YouTube:** performed only by the human student, personally, never in CI or by an automated agent.
- **Performance budgets:** set in Phase 6 (for example, scoring overhead under a few percent CPU and no dropped playback frames).

---

## 12. Security and privacy requirements (implementation checklist)
- [ ] No third-party network calls, no analytics, no remote code.
- [ ] Minimal permissions; each permission justified in an ADR.
- [ ] Strict CSP for extension pages.
- [ ] Edge: no cookies, strict CORS, no request logging in application code, secrets only via `wrangler secret`.
- [ ] "Delete all local data" removes cache, settings, and annotation records.
- [ ] Privacy notice is plain-language, lists exactly what leaves the device (a hash prefix, only after a Bloom positive) and mentions that Cloudflare may log connection metadata.
- [ ] Dependency audit in CI; lockfiles committed.

---

## 13. Risks and open questions
| Risk | Status |
|---|---|
| Audio capture blocked or silent on YouTube | Evidence of CORS-silence and CSP/worklet issues; **Spike A** decides |
| Detector generalization collapse on unseen generators/speakers | Supported by published benchmarks; mitigated by held-out generator/speaker splits and honest reporting |
| Proxy features invalid for "attention harm" | Unvalidated hypothesis; ablations and rubric agreement will show |
| Ground truth for narration origin in the wild is noisy | Annotator-judged with confidence; supplement with known-origin lab clips |
| Cold start: most videos have no cached verdict | Accepted; local scoring is the main path |
| Shorts swiped before scoring finishes | Retroactive overlay; measure time-to-verdict |
| Prefetch of neighboring Shorts blurs "already watching" | **Spike B** decides; analyze only the playing video |
| Terms-of-service and policy drift | Human re-checks before any release; keep private |
| Overbuilding infrastructure | Cut the edge layer to a minimal demo if time runs short; the research question is detection validity |

---

## 14. Rules of engagement for the coding agent
1. Work in small, reviewable commits and PRs; each PR states which phase/task it advances and which acceptance criterion it meets.
2. Write tests first or alongside code; do not mark a task done with failing tests.
3. Record every non-trivial decision in an ADR. Record every assumption.
4. Keep the feature dictionary, `features.config.json`, and docs in sync with code.
5. Never invent measurements. If a number is not measured, label it as a hypothesis.
6. Prefer the simplest model that meets the acceptance criterion. Explain any complexity added.
7. If a task conflicts with §2, stop and ask the human before proceeding.
8. Never hit youtube.com from code, tests, or scripts. Real-site checks are manual and performed by the human.
9. At the end of each phase, update `docs/report/` with results so the final write-up assembles itself.

---

## 15. Deliverables checklist
- [ ] Spike reports (A, B, C) and ADRs
- [ ] Shared feature library, Node CLI, parity tests
- [ ] Research harness with reproducible pipelines and MLflow runs
- [ ] Frozen, annotated test set with agreement statistics (features and ratings only; no media)
- [ ] Trained, calibrated, versioned models and threshold selection record
- [ ] Extension (private build) with consent flow, overlay, options, annotation mode
- [ ] Edge service, Bloom pipeline, latency and anonymity-set analyses
- [ ] Threat model, privacy notice, data-flow diagram, license register
- [ ] Final report with limitations (evidence caveats, scope limits, cold start, evasion)
- [ ] Updated abstract that matches what was built and measured

---

## Appendix A: Default parameters (tune and record changes in ADRs)
| Parameter | Default |
|---|---|
| `MIN_SPEECH_SECONDS` | 5 |
| Frame sample rate | 6 fps |
| Frame size | 64×36 grayscale |
| FFT size / hop | 2048 / 512 |
| Hash prefix `P` / suffix `Q` | 5 / 11 hex chars |
| Bloom target FPR | 0.001 |
| Bucket padded size | 32 entries |
| Verdict cache TTL | 7 days (re-check on model version change) |
| `tau_s`, `tau_h` | Chosen on validation data; user-adjustable |

## Appendix B: Reference findings from research (re-verify before relying on them)
- Chrome Web Store Limited Use policy: only data necessary for the disclosed single purpose; browsing-activity collection prohibited except as needed for a prominently described user-facing feature. https://developer.chrome.com/docs/webstore/program-policies/limited-use
- `MediaElementAudioSourceNode` outputs zeros under CORS restrictions. https://chromium.googlesource.com/chromium/blink/+/HEAD/Source/modules/webaudio/MediaElementAudioSourceNode.cpp and https://github.com/vantezzen/skip-silence/issues/71
- An extension project abandoned an AudioWorklet approach on YouTube because of CSP behavior with `blob:` URLs, and notes `captureStream()` is blocked on DRM-encrypted media. https://github.com/ywong137/speech-speed
- Workers KV is eventually consistent and optimized for read-heavy loads; `cacheTtl` default is 60 s. https://developers.cloudflare.com/kv/reference/how-kv-works/
- India DPDP Rules notified 13 Nov 2025; consent-manager provisions 13 Nov 2026; core duties 13 May 2027. https://www.jsalaw.com/?p=55573
- EDPB Guidelines 01/2025: pseudonymised (including hashed) data generally remains personal data. https://www.pearlcohen.com/european-privacy-regulators-issue-guidance-on-pseudonymization-of-personal-data/
- Short-form video and cognition meta-analysis (Psychological Bulletin, 2025): associations with attention and inhibitory control; correlational, largely self-reported.
