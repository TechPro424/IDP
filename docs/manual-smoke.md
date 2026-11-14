# Manual smoke test

Two automated suites exist:
- `pnpm test:browser` — 6 content-script tests (the built script injected into a
  mock watch page with a stubbed `chrome.*`) and 1 browser-vs-Node feature
  parity test. Runs anywhere Chromium starts.
- `SLOP_E2E_FULL=1 pnpm -C packages/extension exec playwright test` — 10 tests
  against the *loaded extension*. Needs a Chromium that can host unpacked
  extensions; the full binary dies with
  `process_singleton_posix.cc:297] Check failed: . socket() failed: Operation not
  permitted (1)` where AF_UNIX sockets are blocked, and `chrome-headless-shell`
  cannot load extensions at all. CI sets this on a plain runner.

What no test can judge is whether the card is *useful* and whether the numbers
are honest. Run this by hand before a release; it takes about ten minutes.

Load the unpacked build from `packages/extension/dist` via
`chrome://extensions` → Developer mode → Load unpacked.

## 1. Nothing happens until you opt in

| Step | Expected |
| --- | --- |
| Open any YouTube watch page with the extension installed and untouched | No overlay, no badge, no console errors |
| Open the popup, toggle "Enable filter" | Toggle springs back; message says consent is required |
| Open Settings, tick consent + enable, Save | Settings persist across a browser restart |

## 2. A clean video stays quiet

| Step | Expected |
| --- | --- |
| Play a normal, well-made video with speech | No overlay |
| Open the service worker console (`chrome://extensions` → service worker) | One `scoreVideo` log, verdict `ALLOW` |

## 3. A synthetic-sounding video gets a card

Use a video with flat TTS narration and frequent cuts.

| Step | Expected |
| --- | --- |
| Wait for the video to play (capture is 6 s) | Card appears top-left within ~10 s |
| Read the card | Says "Likely/possibly synthetic narration" and "Advisory only (N%)" |
| Click "Why am I seeing this?" | Per-dimension reasons listed, not raw numbers only |
| Click "Show anyway" | Card disappears; playback is untouched |
| Reload the page | Card reappears from cache within ~1 s (no second 6 s capture) |

## 4. Failure surfaces are visible

| Step | Expected |
| --- | --- |
| Mute the video, load a page | Card says the audio signal is missing; verdict is never BLOCK |
| Disable the service worker (`chrome://extensions` → stop), load a page | Card says the analyzer did not respond — not silence |
| Play a video whose page has no captions | Still works, H scored from visual only |

## 5. Navigation and Shorts

| Step | Expected |
| --- | --- |
| Click a related video (SPA navigation, no reload) | The old card disappears, a new analysis runs |
| Open `youtube.com/shorts/<id>` | Analysis runs there too |
| Navigate during a pre-roll ad | No card while `ad-showing` is set; analysis runs after the ad |

## 6. Data and privacy

| Step | Expected |
| --- | --- |
| Settings → Export | A JSON file with your annotations, nothing else |
| Settings → Delete local data | Settings, cache, and annotations gone; `chrome.storage.local` empty |
| DevTools → Network, edge origin unset | Zero requests to any origin other than youtube.com |
| Set an edge origin, watch a video | At most one request, path `/v1/bucket/<5 hex chars>`; no query string, no full URL |

## 7. Firefox (if shipping there)

`pnpm run build:firefox`, then `about:debugging` → Load Temporary Add-on →
`dist-firefox/manifest.json`. Repeat sections 1–3.
## 8. Performance budget (plan §11, Phase 6)

The two build/runtime budgets are checked automatically; the smoother ones need
eyes on a compositor.

Automated (`pnpm test:browser`):

| Check | Budget |
| --- | --- |
| `content.browser.spec.ts` → *analysis does not block the main thread* | no long task ≥ 150 ms, and at most one ≥ 50 ms per analysis |
| `pnpm -C packages/extension build` → `check-bundle.mjs` | `content.js` under 60 kB, no `node:` built-in in any shipped file |

By hand, after a change to `content.ts` or the feature library:

| Step | Expected |
| --- | --- |
| Chrome DevTools → Performance, record 15 s of playback with the filter enabled | No long task over 50 ms attributable to `content.js` — one ~85 ms task right as the capture window closes is expected and comes from the browser's audio graph, not from our JS |
| Same recording, "Frames" lane | No dropped frames while the 6 s analysis window is open |
| `chrome://extensions` → the extension's service worker → Performance | `scoreVideo` under 50 ms (plan §5: inference budget) |

The sampling and feature loops yield on purpose (`setTimeout` between frames,
`YIELD_EVERY` frames in `extractAudioFeatures`); a change that removes those
awaits will show up as dropped frames here *and* inflate `cutsPerMinute`.
