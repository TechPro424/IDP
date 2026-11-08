# SETUP — from clone to a usable extension

Everything below is a command or a click. Commands run from the repo root unless
noted. Nothing needs a dataset except the optional last section.

## 1. Install

Needs Node ≥ 22, pnpm ≥ 9, and Chrome ≥ 116.

```bash
pnpm install
pnpm build        # extension -> packages/extension/dist, edge -> worker build
```

Checks (optional, ~2 minutes):

```bash
pnpm test          # 18 suites: features, scoring, bloom, edge, state machine, ffmpeg cross-check
pnpm test:browser   # 7 Chromium tests (needs `pnpm exec playwright install chromium`)
SLOP_E2E_FULL=1 pnpm -C packages/extension exec playwright test   # the 10 that need a real extension host
```

## 2. Load it in Chrome

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → pick `packages/extension/dist`.
4. Pin the extension so the popup is one click away.

To rebuild after a code change: `pnpm -C packages/extension build`, then press the
reload button on the extension card.

## 3. Turn it on

1. Open the extension popup, click **Settings** (opens the options page).
2. Tick **I understand and consent**.
3. Tick **Enable the filter**, then **Save Settings**.
4. Play a YouTube video and wait ~6 seconds of playback.

Nothing is enabled until step 2: with consent off the toggle refuses to stay on.

## 4. What you should see

An advisory card in the top-left, only when the verdict is BLOCK or REVIEW.
Silence means ALLOW, or "the filter is off".

- **"Show anyway"** dismisses the card and records that you disagreed.
- **"This looks fine"** records a false positive.
- **"Why am I seeing this?"** lists the per-dimension reasons.

## 5. If nothing appears

| Symptom | Cause |
|---|---|
| No card at all | Consent or enable is off (`chrome://extensions` → the extension card → Service worker → Console, look for `[slop-filter]` logs) |
| "The video is muted" | Unmute it — a muted element feeds silence, which is not the same as "no speech" |
| "Not enough signal" | No captions and no readable frames; `H` needs at least one of them |
| "The browser blocked audio…" | Click on the page once, then reload |
| "The analyzer did not respond" | The service worker was stopped; reload the page |

Sanity-check the feature pipeline without a browser:

```bash
node --loader ts-node/esm packages/features/scripts/cli.ts some-audio.wav captions.txt
```

## 6. Optional: Firefox

```bash
pnpm -C packages/extension run build:firefox
```

`about:debugging` → **This Firefox** → **Load Temporary Add-on** →
`packages/extension/dist-firefox/manifest.json`.

## 7. Optional: zip for the store

```bash
pnpm run package:chrome    # packages/extension/dist_chrome.zip
pnpm run package:firefox   # packages/extension/dist_firefox.zip
```

## 8. Optional: use the edge pre-filter

Off by default — with no edge origin the extension makes **zero** network
requests.

```bash
cd packages/edge
npx wrangler login
npx wrangler kv namespace create KV     # paste the id into wrangler.toml
npx wrangler deploy
curl https://<worker>.workers.dev/health
```

Then publish a filter built from confirmed-slop URLs:

```bash
node --loader ts-node/esm packages/edge/scripts/publish-bloom.ts \
  --urls known-slop.txt --version model-1 --out dist
bash dist/upload-kv.sh                  # review it first: writes to remote KV
```

Set `BLOOM_VERSION` in `packages/edge/wrangler.toml` to the same string and
redeploy. Finally put the worker URL in the options page field **Edge origin**;
the browser will ask for permission for that one host.

Only a 5-hex-character prefix of the URL hash ever leaves the device, buckets are
padded to 32 entries, and the edge can only downgrade ALLOW → REVIEW — never
BLOCK.

## 9. Optional: train the model on your own data

The repo ships a **prior**, not a fitted model (`packages/scoring/src/model.ts`).
Every number in the docs comes from a run like this:

```bash
# 1. media: 16 kHz mono wav + plain-text captions per video
yt-dlp -x --audio-format wav --postprocessor-args "-ar 16000 -ac 1" -o "%(id)s.%(ext)s" "URL"
yt-dlp --skip-download --write-auto-subs --sub-format vtt --sub-langs en -o "%(id)s.%(ext)s" "URL"
sed -e '/-->/d' -e '/^[0-9:.]*$/d' -e '/^WEBVTT/d' VIDEO.vtt > VIDEO.txt

# 2. manifest.csv with columns: file,label,captions   (label 1 = synthetic narration)
# 3. annotate with docs/rubric/annotation-rubric.md (two blinded annotators, κ ≥ 0.75)
# 4. features -> CSV
node --loader ts-node/esm packages/scripts/build-training-set.ts \
  --manifest packages/data/processed/manifest.csv --out-dir packages/data/processed --split 0.8 --seed 1337
# 5. fit + calibrate
python packages/scripts/train-model.py --train packages/data/processed/train.csv \
  --val packages/data/processed/val.csv --out packages/scoring/model.json --seed 1337
# 6. thresholds (validation only)
python packages/scripts/compute-thresholds.py --val packages/data/processed/val.csv \
  --precision-floor 0.85 --gray-band 0.1 --out packages/scoring/thresholds.json
# 7. frozen test set -> results/evaluation.md
python packages/scripts/evaluate.py --data tests/frozen_test_set/labels.csv --out results/evaluation.md
```

After step 5, copy the fitted coefficients into `DEFAULT_MODEL` in
`packages/scoring/src/model.ts` and bump `ML_MODEL_VERSION` in
`packages/extension/background.ts` (the verdict cache is keyed on it). After
step 6, set the thresholds in **both** `packages/scoring/src/index.ts`
(`DEFAULT_THRESHOLDS`) and `packages/extension/settings.ts` (`DEFAULT_SETTINGS`).

Target corpus: ≥ 250 videos, both classes at ≥ 40 %, negatives from the *same*
genres, no music-only/no-speech/< 30 s clips. Do not commit media or annotations.

## 10. Rules

- The metric scripts **exit non-zero without real data**. That is the feature;
  do not patch around it.
- Never tune on the frozen test set.
- `pnpm test` must stay green; `docs/manual-smoke.md` is the by-hand version when
  Chromium cannot launch.