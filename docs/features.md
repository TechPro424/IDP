# Feature Dictionary

Source of truth for parameters: `packages/features/src/config.ts` (browser-safe, imported by
the extension). Every value below names the code that produces it.

## Audio — `packages/features/src/audio.ts`

Framed at `frameSize = 2048`, `hopSize = 512`, `rmsThreshold = 0.05`, `minPauseMs = 200`.
Spectral values come from Meyda; pitch from autocorrelation.

| Key | Meaning | Unit | Range |
|---|---|---|---|
| `avgFlatness` · `flatnessVariance` | spectral flatness, mean and variance over voiced frames | 0–1 | higher = noisier |
| `avgCentroid` · `centroidVariance` | spectral centroid mean/variance | Hz | 0–Nyquist |
| `avgPitch` · `pitchVariance` · `pitchMad` | F0 mean, variance, median absolute deviation | Hz | 50–500 |
| `jitter` | mean absolute frame-to-frame relative F0 change | ratio | 0–1; human speech ≈ 0.01–0.05 |
| `voicedRatio` | fraction of frames above `rmsThreshold` | ratio | 0–1 |
| `speechRatio` | voiced frames / analysed frames | ratio | 0–1 |
| `nSpeechSeconds` | total voiced duration | s | 0–∞ |
| `pauseCount` · `pauseMeanSec` · `pauseVarianceSec` | unvoiced runs ≥ `minPauseMs` | count / s / s² | — |
| `loudnessRangeDb` | p95 − p5 of frame RMS, in dB | dB | 0–60 |
| `musicSuspected` | heuristic: high flatness variance + low pitch variance | bool | — |
| `syntheticLikelihood` | **heuristic proxy** `min(1, voicedRatio * 2)` | score | 0–1 |
| `missing` | true when `nSpeechSeconds < MIN_SPEECH_SECONDS (5)` | bool | — |

`syntheticLikelihood` is the weakest link in the system: it measures "is there continuous
speech", not "is the speech synthetic". It exists so the pipeline can be exercised end to
end. Replacing it needs a trained detector (plan §9.3), which needs data we do not have.

## Visual — `packages/features/src/visual.ts`

Input frames are `ImageData` at `downsampleWidth = 64` × `downsampleHeight = 36`, sampled at
6 fps. Shot boundary = mean absolute luma difference above
`max(shotAbsFloor = 12, runningMean + 3σ)`, with a `minShotLengthFrames = 3` refractory
period. The running mean/σ use Welford's algorithm and are updated **after** the test, so a
cut cannot raise its own threshold.

| Key | Meaning | Unit |
|---|---|---|
| `shotCount` | detected boundaries | count |
| `staticFrameRatio` | frames below the adaptive threshold | 0–1 |
| `avgShotIntervalFrames` · `asiMeanFrames` · `asiCV` | shot-interval mean and coefficient of variation | frames / ratio |
| `cutsPerMinute` | `shotCount / durationMinutes` | cuts/min |
| `meanInterFrameDiff` | mean absolute luma delta | 0–255 |
| `colorHistogram` | 8-bin luma histogram, normalised | 0–1 each |

## Text — `packages/features/src/text.ts`

Operates on caption/transcript text; compression via the platform `CompressionStream('gzip')`
(no `node:zlib`).

| Key | Meaning | Range |
|---|---|---|
| `tokenEntropy` | Shannon entropy of the token distribution | bits |
| `typeTokenRatio` | unique tokens / total tokens | 0–1 |
| `repeatedNgramRatio` | fraction of repeated 3-grams | 0–1 |
| `gzipRatio` | gzip size / raw size | 0–1 (lower = more repetitive) |
| `sentenceLengthVariance` | variance of sentence lengths (words) | 0–∞ |

## Hashing — `packages/features/src/hash.ts`

`sha256Hex(canonical watch URL)` via WebCrypto. `prefix = h[0:5]` (20 bits),
`suffix = h[5:16]`. Canonicalisation keeps only `https://www.youtube.com/watch?v=<id>` or
`https://www.youtube.com/shorts/<id>`, dropping every other query parameter.

## Sub-scores — `packages/scoring/src/proxies.ts`

| Score | Derivation |
|---|---|
| `S` | `audio.syntheticLikelihood`, or `undefined` when `audio.missing` |
| `Hatt` | `cutsPerMinute / 40`, clamped |
| `Hsub` | `1 − (0.6·entropy/5 + 0.4·(1−repetition)·(0.5+0.5·TTR))`, clamped |
| `H` | `mean(Hatt, Hsub)`, `undefined` if either is |
| `SRS` | `min(S, H)` |

These are heuristics chosen so the pipeline is testable. Nothing here is fitted to data.

## Parity

`packages/features/tests/parity.test.ts` compares feature vectors produced in Node against
`fixtures/features-golden.json` and regenerates the file when `UPDATE_GOLDEN=1` is set.