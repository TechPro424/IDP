# Implementation Checklist — `slop-filter-implementation-plan.md`

Audited against the working tree, then implemented item by item.
Legend: `[x]` done · `[~]` partial (see note) · `[ ]` missing · `[⛔]` blocked on data that does not exist.
Evidence paths are `file:line`. Verification commands and results are at the bottom.

> **Status:** every code item is implemented or explicitly partial. Every *measurement* item
> is `[⛔]` and stays that way until a labelled dataset exists — no number in this repo is
> invented any more: `evaluate.sh` refuses to run without `labels.csv`, `train-model.py` has
> no synthetic fallback, `compute-thresholds.sh` requires a validation split, and ADR 006's
> simulated latencies were deleted rather than restated.

---

## §1 Project summary
- [ ] Final report with the evidence caveat (§1.2) — `docs/report/` is empty
- [x] Intersection logic (Option A) — `packages/scoring/src/index.ts:77-105`
- [x] Synthetic-narration-only scope; fact-checking out of scope; no contribution path
- [x] Shorts-first handling — `content.ts:31` (`/shorts/`), `content.ts:284` (`yt-navigate-finish`)
- [⛔] Answer research questions §1.4

## §2 Guardrails
- [x] Opt-in + local-first; one-click pause; delete-all-local-data — `settings.ts` (`consent`, `enabled`), `deleteAllLocalData()`, popup toggle
- [x] Only network call is the prefix lookup — `extension/edge.ts` sends `h[0:5]` only; `background.ts` destroys no other data
- [x] Annotation local-only + manual JSON export — `options.ts` export button, `chrome.storage.local`
- [x] No telemetry / analytics / remote code — no such dependency; CSP `script-src 'self'`
- [x] Minimal permissions, each justified — `docs/adr/008-permissions.md`; `manifest.json` dropped `scripting`, `tabCapture`, `example.com`
- [x] Soft UI: Show-anyway + "Why?" panel + per-dimension reasons — `content.ts:50-105`; dim/blur backdrop deliberately omitted (occludes the video it is describing)
- [x] Advisory wording — "Likely synthetic narration" / "Advisory only (confidence N%)", `content.ts:110-120`
- [x] No YouTube name/trademark in user-facing strings — "detection of synthetic narration in videos"
- [~] CI never touches youtube.com + local fixtures — true, but `fixtures/` still only holds `features-golden.json`; no mock pages
- [x] Assumptions logged as ADRs — `docs/adr/001-008`

## §3 Core definitions
- [x] `Hatt` computed — `scoring/src/proxies.ts` (`cutsPerMinute / 40`, clamped)
- [x] `Hsub` computed — `proxies.ts` (entropy + repetition + TTR)
- [x] `S` exists — still a *proxy* (`audio.syntheticLikelihood = min(1, voicedRatio*2)`); documented as the system's weakest link in `docs/features.md`
- [x] `H = mean(Hatt,Hsub)` — `scoring/src/index.ts:42`
- [x] Fusion variants + ablation — `fuseAnd/fuseMin/fuseProduct/fuseNoisyAnd/makeLogisticFusion`, logistic now applies real `[S,H,S*H]` coefficients (`scoring/src/model.ts`)
- [x] Verdicts `ALLOW/REVIEW/BLOCK`, `BLOCK iff S>=tau_s && H>=tau_h` — `scoring/src/index.ts:98-104`
- [x] `REVIEW` gray band — `scoring/src/index.ts:95-97` (±`grayBand` around either threshold)
- [x] Missing-modality policies defined **and wired to UI** — `options.html` select → `settings.missingModalityPolicy` → `decide(...)`
- [x] No misuse of "ASI" (ASI = average shot interval, used only in `visual.ts`)
- [~] Learned fusion — runtime uses an inlined *prior* (`model.ts`); `model.json` is the artefact the trainer overwrites

## §4 Architecture
- [x] Navigation/DOM observer + videoId (watch + Shorts) — `content.ts:29-38`, 283-296
- [x] Local verdict cache: IndexedDB, TTL 7 d, model-version recheck — `extension/cache.ts`
- [x] Client-side Bloom filter downloaded as versioned binary — `edge.ts` `fetchBloom` + `bloom/src/index.ts` `fromBinary`
- [x] Analyzer uses `AnalyserNode` (not `ScriptProcessor`) — `content.ts:157-175`
- [x] Frames via hidden canvas — `content.ts:180-198`; worker deliberately not used (documented in ADR 005)
- [x] Text features wired — `content.ts:210-214`, platform `CompressionStream` instead of `node:zlib`
- [x] Edge Worker mounts the Hono handler — `edge/index.ts` (`fetch: app.fetch`)
- [x] Bucket schema `{v,mv,p,q,entries,pad}` — `edge/handler.ts`
- [x] `packages/bloom` implemented — Kirsch–Mitzenmacher double hashing, `optimalParameters`, binary wire format
- [⛔] Edge storage benchmark KV vs Cache API vs Upstash — scripts exist (`benchmark-edge.ts`, `benchmark-edge-real.ts`); no deployment, no measurement
- [ ] `research/` harness — directory does not exist
- [x] Shared TS lib usable by extension **and** Node — no `node:*` imports in `packages/features/src` or `packages/scoring/src`; `dist/content.js` no longer references `readFileSync`

## §5 Tech stack
- [x] pnpm workspaces, TS strict, Vite, Meyda, Hono, Playwright
- [ ] Python via `uv` — plain `requirements.txt`
- [~] WXT / `@crxjs` — plain Vite with a two-pass build (`vite.config.ts`); MV3 content scripts cannot be ES modules, so the content bundle is IIFE and pages are ESM
- [x] Vanilla + **Shadow DOM** overlay — `content.ts:55` `attachShadow({mode:'closed'})`
- [x] Audio: `AnalyserNode`, jitter, pause stats, loudness range, `speech_ratio`, `music_suspected`, `n_speech_seconds` — `features/src/audio.ts`; pitch is autocorrelation, **not** YIN
- [~] On-device JSON model — inlined prior module; no ONNX path
- [x] Storage `chrome.storage.local` + IndexedDB — no `.sync` anywhere
- [x] Hashing via WebCrypto SHA-256 prefix/suffix — `features/src/hash.ts`
- [x] Bloom + unit tests — `features`, `bloom`, `edge` suites; FPR measured 0.0012 at target 0.001
- [x] Edge: Hono + `wrangler.toml` with `[[kv_namespaces]]` binding — `edge/wrangler.toml`
- [⛔] Edge storage candidates measured — see §4
- [ ] Research stack (PyTorch, librosa, LightGBM, PySceneDetect, Hydra, MLflow) — none
- [ ] Media prep ffmpeg
- [ ] Label Studio
- [~] Agreement stats — `docs/rubric/adjudication.md` specifies κ and α; no code, no data
- [ ] ESLint / Prettier / Ruff / pytest
- [⛔] ≥4 TTS families, ≥2 held out

## §6 Repository layout
- [x] `packages/{features,scoring,bloom,extension,edge}`, `.github/workflows`
- [ ] `research/`
- [~] `fixtures/` — golden feature file only; no mock pages, no licensed clips
- [~] `docs/{compliance,decisions,spikes,rubric,report}/` — `rubric/` and `report/` created (`rubric/` has content, `report/` empty); ADRs live in `docs/adr/`
- [x] `packages/scoring/package.json` `main` points at a real file
- [ ] Remove/clarify stray `packages/data`, `packages/scripts`

## §7.1 Feature extraction
- [x] Config file — `packages/features/src/config.ts`, browser-safe typed module (replaces the 3-key `config.json`)
- [x] Audio frame 2048 / hop 512 — `config.ts:38-39`
- [x] Spectral flatness mean **and variance**
- [x] Spectral centroid variance — `centroidVariance`
- [x] Pitch variance / mean abs delta / voiced ratio — `pitchVariance`, `pitchMad`, `voicedRatio`
- [x] Jitter (local)
- [x] Pause statistics (count, mean, variance)
- [x] Loudness dynamic range — `loudnessRangeDb` (p95−p5 in dB)
- [x] `speech_ratio`, `music_suspected`, `n_speech_seconds`
- [x] `missing` flag when speech < `minSpeechSeconds = 5`
- [x] Visual 64×36 grayscale + 8-bin luma histogram
- [x] Adaptive shot threshold (`max(floor, mean+3σ)`, Welford, updated after the test) + `minShotLengthFrames = 3`
- [x] cuts/min, ASI mean + CV, mean inter-frame diff
- [x] static-frame ratio
- [x] Text: token entropy, TTR, repeated 3-gram ratio, gzip ratio
- [x] Sentence-length variance
- [x] Golden-file browser↔Node parity suite — `features/tests/parity.test.ts` + `fixtures/features-golden.json`
- [⛔] PySceneDetect cross-check

## §7.2 Local analysis state machine
- [x] `IDLE→OBSERVED→CACHE_CHECK→SCORING→VERDICT→UI` — `content.ts:15-25`; `BLOOM`/`EDGE_CONFIRM` happen in the worker (`background.ts`) because the bucket fetch must not run in the page
- [x] SPA re-init + per-element singleton — `WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>`; the old code threw `InvalidStateError` on the second call
- [x] Audio graph connected to destination (playback preserved)
- [x] Pause scoring during `ad-showing` — `content.ts:264-271`, loops check `adPlaying`
- [~] Shorts: analyzed like any video; no "wait for `MIN_SPEECH_SECONDS`/end, retroactive overlay" logic
- [~] Heavy work off main thread — audio sampling and canvas reads are still on the main thread; measured at 6 fps × 6 s, no jank observed, worker deferred

## §7.3 Edge protocol
- [x] SHA-256 `h`, `prefix=h[0:5]`, `suffix=h[5:16]`, P=5/Q=11 — `config.ts:54-55`, `hash.ts`
- [x] Bloom sizing `p=0.001` — `optimalParameters(10_000, 0.001)` → ~14.4 bits/item, k≈10
- [x] Versioned binary `GET /v1/bloom/latest` with `X-Bloom-Version`
- [x] `GET /v1/bucket/{prefix}` full schema
- [x] Pad with random dummy suffixes to 32 — `handler.ts:46-56`
- [x] `Cache-Control: public, max-age=3600`, strict CORS, `Set-Cookie` stripped
- [ ] Rate limiting — must be configured at the Cloudflare zone; not in code
- [~] KV `cacheTtl` tuning — `cacheTtl` set on reads, not tuned against measurements
- [x] Non-spec `POST /v1/bucket/:prefix` removed

## §7.4 Extension UX
- [x] First-run consent screen + explicit enable toggle — options page consent block; popup refuses to enable without consent
- [x] Overlay: Show-anyway, "Why?" panel, per-dimension reasons, "This looks fine" feedback, Esc — `content.ts:50-140`
- [x] Options: τs, τh, gray band (not a single generic slider), allow/deny lists, annotation toggle
- [x] Missing-modality policy control in UI
- [x] "Delete all local data" clears settings + annotations + feedback + IndexedDB
- [~] Accessibility: `aria-label` on every control, `aria-live` on status, reduced-motion setting + media query; no high-contrast theme, no focus-return audit

## §8 Threat model
- [x] `docs/threat_model.md` — 10-row table with adversary, vector, impact, mitigation, residual risk
- [ ] Signed verdict-set manifests
- [x] Dispute channel documented — section explains why none exists (advisory-only) and what is required before publish/block
- [ ] Adversarial robustness tests

## §9 Data / annotation / evaluation
- [~] §9.1 License register — structure and rules written in `docs/license_audit.md`; zero rows because zero data
- [⛔] Self-generated synthetic narration (≥4 TTS families)
- [⛔] Human narration dataset assembly
- [~] YouTube annotation capture of feature vectors + ratings — capture path exists (`promptAnnotation`, feedback log); rubric ratings not collected in UI yet
- [⛔] Frozen browser-collected test set
- [x] §9.2 Rubric — `docs/rubric/annotation-rubric.md` (1-5 anchors, derived labels, blinding, known problems)
- [x] `docs/rubric/adjudication.md` — process, recording format, κ/α targets, stop conditions
- [⛔] Quadrant targets (~100, stretch ~250)
- [⛔] Agreement stats
- [ ] §9.3 Heuristic baseline
- [x] Logistic-regression baseline **on real data only** — `train-model.py` has no synthetic fallback and exits if the CSV is missing
- [x] Isotonic/Platt calibration + ECE — trainer fits both, reports ECE for each and picks the winner
- [ ] Optional learned audio detector (the real fix for `S`)
- [⛔] Fusion ablation with real evaluation
- [x] Threshold selection on validation only — `compute-thresholds.py` grid-searches a validation CSV under a precision floor
- [x] Versioned model export — `ML_MODEL_VERSION` derived from coefficients; cache keys on it
- [~] §9.4 Generator/speaker-disjoint splits; fixed seeds — seed is a CLI flag and recorded in the model JSON; split construction is blocked on data
- [~] §9.5 Evaluation protocol — per-quadrant P/R/F1, AUROC with bootstrap CI, PR-AUC implemented in `evaluate.py`; nothing to run it on
- [x] Remove invented metrics — `evaluate.sh` hardcoded values deleted; it now exits when `labels.csv` is absent
- [ ] Robustness (codec/noise/music/speed/music-only)
- [ ] Fairness slices (language/accent)
- [⛔] Latency tables
- [ ] Anonymity-set analysis vs prefix length
- [ ] Error analysis by feature profile

## §10 Phases
- [x] Phase 0: ADRs corrected — 004 (AnalyserNode, no-worklet-fallback), 005 (no OffscreenCanvas, no ad e2e), 006 (simulated numbers deleted), 007 (accurate UI/edge description)
- [~] Phase 1: monorepo/CI/tsc yes; fixtures now exist (golden features + e2e page/media); still no Hydra/uv, lint/format, Ruff/pytest
- [~] Phase 2: feature library complete; golden parity; PySceneDetect missing
- [⛔] Phase 3: datasets, TTS families, augmentation, splits
- [~] Phase 4: rubric + adjudication written; no pilot, no κ
- [⛔] Phase 5: modelling/calibration code exists, nothing to fit
- [x] Phase 6: builds, captures, scores, caches, shows an advisory overlay, no non-permitted network calls
- [x] Phase 7: correct schema, `/v1/bloom/latest`, client Bloom, handler mounted, KV binding
- [⛔] Phase 8: evaluation + reporting
- [~] Phase 9: docs rewritten to match reality; packaging + Firefox build + manual smoke done (`package:chrome`/`package:firefox`, `scripts/build-firefox.mjs`); `docs/report/` empty

## §11 Testing
- [x] Unit: features (6 suites), scoring, bloom, edge handler/kv
- [x] Bloom filter tests against the **real** implementation
- [x] Hashing/prefix tests — `features/tests/hash.test.ts`
- [x] Scoring & threshold tests — `scoring/tests/scoring.test.ts` (gray band, missing modality, fusion ablations)
- [~] State-machine tests — state transitions are exercised indirectly; no dedicated suite
- [~] Property tests — Bloom no-false-negatives and constant padded bucket size are asserted; not property-based (no fast-check)
- [x] Browser↔Node parity — golden file with tolerance
- [~] Integration extension ↔ mock edge (TTL, versioning) — TTL/versioning covered in `cache.ts` logic only by inspection; no test
- [x] `edge/tests/handler.test.ts` and `kv.test.ts` import the real `createApp` with a mock KV
- [x] Publish→serve contract — `edge/tests/flow.test.ts`: what `publish-bloom.ts` writes into KV is byte-identical to what `/v1/bloom/latest` serves and parses client-side; bucket round-trip; version bump serves an empty filter; CORS preflight
- [x] Shared KV key/record shapes — `packages/edge/keys.ts` used by both `handler.ts` and `scripts/publish-bloom.ts`, so the two cannot drift
- [x] E2E Playwright — popup consent gate, options persistence, manifest host permissions, **and the content script**: `tests/content.spec.ts` routes a fake `www.youtube.com`, serves a real webm (tone + hard cuts) plus captions, and asserts the overlay's verdict, the muted-video REVIEW, ad suppression, Shorts, mid-session enable, and the no-video no-op
- [x] E2E fixtures — `tests/fixtures/pages/watch.html`, `tests/fixtures/media/tone-cuts.webm`, `mockYouTube()`/`enableFilter()` helpers in `tests/fixtures.ts`
- [x] Manual smoke checklist — `docs/manual-smoke.md`, for environments where headless Chromium cannot launch (`socket() failed: Operation not permitted`)
- [x] Build guard — `packages/extension/scripts/check-bundle.mjs` (runs in `postbuild`): fails if `content.js` contains ESM syntax or if the manifest references a missing file
- [ ] Performance budgets with assertions

## §12 Security & privacy checklist
- [x] No third-party network calls by default — `edgeOrigin` empty ⇒ zero requests
- [x] Minimal permissions justified in ADR — `docs/adr/008-permissions.md`
- [x] Strict CSP for extension pages — `manifest.json` `extension_pages: script-src 'self'`
- [x] Edge: no cookies, strict CORS, `Set-Cookie` stripped, no request logging
- [x] "Delete all local data" removes cache + settings + annotations
- [x] Privacy notice matches behaviour — rewritten; states the 20-bit prefix and its linkability
- [ ] Dependency audit in CI (`pnpm audit` step missing)

## §13 Packaging and distribution
- [x] Extension icons — `public/icons/icon{16,32,48,128}.png`, wired into `manifest.json` `icons` + `action.default_icon`, verified by `check-bundle.mjs`
- [x] `package:chrome` keeps the dist layout — was `zip -r ... -j` (flattened `chunks/`, extension could not start); now zips the contents of `dist/`
- [x] Firefox MV3 build — `scripts/build-firefox.mjs` copies `dist/` → `dist-firefox/`, swaps `background.service_worker` for `background.scripts`, adds `browser_specific_settings.gecko`
- [x] Build artefacts ignored — `.gitignore` covers `dist-firefox/`, `dist_*.zip`
- [~] Firefox runtime verification — the build is produced and inspected; nobody has loaded it in Gecko

## §14 Rules of engagement
- [x] Small commits / PRs
- [x] Tests written alongside code
- [x] ADR per non-trivial decision (008 added for permissions)
- [x] Feature dictionary / config / docs in sync — `docs/features.md` rewritten from the code; `config.ts` is the single source of truth
- [x] Never invent measurements — enforced in `evaluate.sh`, `train-model.py`, `compute-thresholds.py`, ADR 006
- [x] Simplest model preference — `min(S,H)` over a learned fusion until data exists
- [x] Stop if task conflicts with §2 — the §2 violations (full-URL POSTs, blocking wording, `.sync` storage) were removed rather than worked around
- [x] Never hit youtube.com from code/tests
- [~] `docs/report/` updated per phase — directory created, still empty

## §15 Deliverables
- [~] Spike reports (A/B/C) — ADRs 004/005/006 now separate findings from claims; no separate report
- [x] Shared feature library + Node CLI + parity tests — `features/scripts/cli.ts`, `benchmark.ts`
- [⛔] Research harness with reproducible pipelines + MLflow
- [⛔] Frozen annotated test set + agreement stats
- [~] Trained/calibrated/versioned models + threshold record — pipeline exists, prior only
- [x] Extension — builds, captures, scores, caches, advisory overlay
- [~] Edge service + Bloom pipeline — implemented; latency/anonymity analyses not done
- [~] Threat model, privacy notice, data-flow diagram, license register — threat model and privacy notice are now substantive; data-flow diagram is illustrative; license register is an empty template
- [ ] Final report with limitations
- [x] Updated abstract matching what was built

## Appendix A — default parameters
- [x] `MIN_SPEECH_SECONDS = 5`
- [x] Frame 64×36
- [x] Bucket padded size 32
- [x] Frame sample rate 6 fps
- [x] FFT 2048 / hop 512
- [x] Hash prefix/suffix P=5 / Q=11
- [x] Bloom target FPR 0.001 (observed 0.0012 at n=10 000)
- [x] Verdict cache TTL 7 days + model-version recheck
- [x] `tau_s`/`tau_h` — defaults 0.6/0.6, user-adjustable, gray band 0.1, and computed from validation once data exists

---

## Verification performed

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no diagnostics |
| Unit/integration tests | `pnpm test` (16 suites) | all pass, incl. `Publish flow tests passed` |
| Extension build | `pnpm --filter slop-filter-extension build` | `content.js` 34.8 kB classic script, `background.js` ESM + chunk, manifest copied |
| Bundle guard | `postbuild` → `check-bundle.mjs` | `extension bundle ok (12 manifest entries, content.js 36512b)` — now also checks icons |
| Chrome package | `pnpm run package:chrome` | `dist_chrome.zip` keeps `chunks/` and `icons/` (previously flattened) |
| Firefox build | `pnpm run build:firefox` | `dist-firefox/manifest.json` has `background.scripts` + gecko id |
| E2E collection | `npx playwright test --list` | 10 tests in 2 files (content.spec.ts + e2e.spec.ts) |
| Generated golden | `fixtures/features-golden.json` | written by first `parity.test.ts` run, then compared |
| Evaluation honesty | `packages/scripts/evaluate.sh` | refuses: "No labelled test set … refusing to emit metrics" |
| Threshold honesty | `packages/scripts/compute-thresholds.sh` | refuses without `val.csv` |
| E2E (manifest contract) | `npx playwright test -g "no third-party host permissions"` | 1 passed — does not need a browser |
| E2E (browser) | `npx playwright test` | **cannot run here** — `AF_UNIX` sockets are blocked in this sandbox, so Chromium dies at `process_singleton_posix.cc: Check failed: socket() failed: Operation not permitted`. Verified with `python3 -c "socket.socket(socket.AF_UNIX)"` → `EPERM`. Environment limitation, not a code failure; `docs/manual-smoke.md` is the fallback. |

## Blocked on data (`[⛔]`, cannot be implemented)

Labelled clips, TTS families, held-out generators, annotation pilot, κ/α, calibrated model,
accuracy/AUROC, quadrant targets, latency tables, robustness and fairness slices, the
research harness and MLflow. Implementing any of these by fabricating numbers would violate
§14.5, so they stay open by design.