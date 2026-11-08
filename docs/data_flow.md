# Data Flow

```mermaid
flowchart TD
  subgraph Device
    A[<video> element] -->|createMediaElementSource + AnalyserNode| B[content.ts: captureAudio]
    A -->|64x36 canvas @6fps| C[content.ts: sampleFrames]
    D[.ytp-caption-segment] -->|text| E[content.ts: collectCaptions]
    B --> F[features/src/audio.ts]
    C --> G[features/src/visual.ts]
    E --> H[features/src/text.ts]
    F & G & H --> I[chrome.runtime.sendMessage scoreVideo]
    I --> J[background.ts]
    J --> K[scoring/src/proxies.ts → S, Hatt, Hsub]
    K --> L[scoring/src/index.ts decide: min(S,H), gray band]
    L --> M[(IndexedDB counterfactual cache, 7 d TTL + model version)]
    L --> N[Verdict]
    N -->|message| O[closed Shadow DOM overlay, advisory only]
  end

  subgraph Optional["Optional, only if an edge origin is configured"]
    J -->|"GET /v1/bloom/latest (once per version)"| P[Edge Worker]
    P -->|binary Bloom blob| Q[local Bloom test of sha256(url)[0:5]+[5:16]]
    Q -->|"only on a positive: GET /v1/bucket/{prefix}"| P
    P -->|"32 padded entries"| R[bucketContains suffix]
    R -->|hit can raise ALLOW to REVIEW, never to BLOCK| L
  end
```

## What crosses the boundary

| Direction | Payload | Notes |
|---|---|---|
| Extension → Edge | `GET /v1/bloom/latest` | no user data at all |
| Extension → Edge | `GET /v1/bucket/{prefix}` | 5 hex chars = 20 bits of `sha256(canonical report URL)` |
| Edge → Extension | Bloom blob, bucket JSON | identical shape for every prefix thanks to padding |

Nothing else leaves the device: no URL, no video id, no title, no features, no verdict, no
account. There is no POST from the extension to the edge — a bucket can only be read, not
written. With `edgeOrigin` empty, the `Optional` subgraph is not executed at all.

## What stays local

`chrome.storage.local` holds settings, consent, allow/deny lists, annotations and feedback
(`recordFeedback`). IndexedDB `slop-filter` holds counterfactual verdicts. Neither is ever
synced; "Delete All Stored Data" clears both.

## Trust boundary

The edge is treated as **untrusted input**: a bucket hit is only ever allowed to make the
verdict more cautious (ALLOW → REVIEW). It can never produce a BLOCK, because BLOCK requires
local `S ≥ τs ∧ H ≥ τh`. A compromised or poisoned edge deployment can therefore cost recall,
not cause false accusations.