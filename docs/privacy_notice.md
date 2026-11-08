# Privacy Notice

_Last updated with the code that ships in `packages/extension` — see `CHECKLIST.md` for the per-item audit._

## What is processed and where

All audio, video-frame and caption analysis happens **on your device**, inside the page.
Audio is sampled from the `<video>` element into an `AnalyserNode`, reduced to a small set
of numbers (energy, spectral shape, pitch statistics, pause statistics) and the samples are
then discarded. Frames are reduced to 64×36 grayscale statistics and discarded. Nothing is
stored in raw form.

## What can leave the device

Only if you configure an **edge origin** in Settings:

1. A SHA-256 hash of the canonical watch URL is computed locally.
2. Only `prefix = hash[0:5]` (5 hex characters = 20 bits) is ever requested:
   `GET /v1/bucket/{prefix}`.
3. Before that request, a Bloom filter is downloaded once per version
   (`GET /v1/bloom/latest`); the membership test also happens locally, so a
   Bloom-negative video causes **no** per-video request.

With the edge origin left empty — the default — the extension makes **no network requests
at all**.

We do not send the URL, the video id, the title, your account, your IP-derived location,
watch history, or any feature vector. The 20-bit prefix is shared by roughly 1 in a million
URLs, so it is not a stable identifier on its own; it is, however, linkable across requests
from the same client. See `docs/threat_model.md` for that limitation.

## What is stored locally

| Data | Where | Cleared by |
|---|---|---|
| Settings, consent flag, allow/deny lists | `chrome.storage.local` | "Delete All Stored Data" |
| Verdict cache (video id + verdict + reasons, 7-day TTL) | IndexedDB `slop-filter` | "Delete All Stored Data" |
| Annotations and "this looks fine" feedback | `chrome.storage.local` | "Delete All Stored Data" |

Nothing is written to `chrome.storage.sync`, so nothing is uploaded to a Google account.

## Consent, pause, deletion

- The filter is **off** until you tick the consent box and enable it (Settings).
- The popup toggle pauses it at any time; the overlay can be dismissed per video.
- "Delete All Stored Data" removes settings, annotations, feedback and the cache, and drops
  the IndexedDB database.

## Third parties

No analytics, no telemetry, no remote code, no third-party SDKs. If you point the extension
at an edge deployment, that deployment's operator (normally you) becomes the processor for
prefix requests; add their logging/retention policy here before distributing such a build.

## Scope and limits

Detection is **advisory**. Verdicts are produced by documented heuristics
(`packages/scoring/src/proxies.ts`), not by a calibrated model; no accuracy claim is made.
The extension never blocks playback, never reports a video to anyone, and cannot affect what
other viewers see.