# Slop Filter

An MV3 browser extension that estimates — locally, on your device — whether a video's
narration is synthetic and whether the content is substantively empty, then shows the viewer
a dismissible advisory overlay.

**Advisory only. Research prototype. No accuracy claim.** See `docs/abstract.md` for what is
real, `CHECKLIST.md` for the item-by-item state of the implementation plan, and `SETUP.md`
for everything that has to happen outside the code (data, annotation, training, thresholds).

## Build

```bash
pnpm install
pnpm build                 # extension (two-pass Vite) + edge worker
pnpm --filter slop-filter-extension build
```

The extension build runs twice: `content.js` as a self-contained classic script (MV3 content
scripts cannot be ES modules) and the worker/pages as ES modules. `postbuild` verifies that
the manifest references only files that exist and that the content bundle has no ESM syntax.

## Test

```bash
pnpm test                  # features, scoring, bloom, edge  (no browser needed)
cd packages/extension && npx playwright test   # drives the real content script; needs a working Chromium
```

If Chromium cannot launch in your environment (sandboxes that block `AF_UNIX` sockets), use
[`docs/manual-smoke.md`](docs/manual-smoke.md) — same coverage, by hand.

## Package

```bash
pnpm run package:chrome    # packages/extension/dist_chrome.zip
pnpm run package:firefox   # packages/extension/dist_firefox.zip (MV3, background.scripts)
```

## Privacy

All analysis is local. With no edge origin configured (the default) the extension makes **no
network requests at all**. With one configured, only a 5-hex-character (20-bit) SHA-256
prefix of the canonical watch URL leaves the device, and only after a local Bloom-negative
test would have skipped it entirely. See `docs/privacy_notice.md`.

## Model training

`packages/scripts/train-model.py` and `compute-thresholds.sh` **refuse to run** without real,
generator/speaker-disjoint data. There is no synthetic fallback — inventing training data is
indistinguishable from inventing results. The runtime ships a documented *prior*
(`packages/scoring/src/model.ts`), not a fitted model.

## Documentation

- [Abstract](docs/abstract.md) — what this is and is not
- [Threat Model](docs/threat_model.md)
- [Privacy Notice](docs/privacy_notice.md)
- [Data Flow](docs/data_flow.md)
- [Feature Dictionary](docs/features.md)
- [Annotation Rubric](docs/rubric/annotation-rubric.md) · [Adjudication](docs/rubric/adjudication.md)
- [Compliance Register](docs/compliance_register.md) · [License Audit](docs/license_audit.md)
- [ADRs](docs/adr/) · [Setup & data pipeline](SETUP.md) · [Next Steps](NEXT_STEPS.md) · [Checklist](CHECKLIST.md)