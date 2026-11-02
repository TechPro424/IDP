# Slop Filter

A browser extension and edge service for detecting synthetic‑narrated slop in YouTube videos.

See `slop-filter-implementation-plan.md` for the full design and roadmap.

## Build

```bash
# Install dependencies
pnpm install

# Build extension and edge worker
pnpm build
```

## Model Training

The logistic‑regression baseline is trained automatically in the CI pipeline via `packages/scripts/train-model.py`.  It reads a CSV from `packages/data/dataset/augmented/train.csv` (a small synthetic dataset is generated if the file does not exist) and outputs the trained weights to `packages/scoring/model.json`.

## Documentation

- [Threat Model](docs/threat_model.md)
- [Privacy Notice](docs/privacy_notice.md)
- [Data Flow Diagram](docs/data_flow.md)
