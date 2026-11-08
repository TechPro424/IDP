# ADR 006: Spike C — Edge Storage

## Context
The edge worker stores one versioned Bloom blob and a small set of prefix buckets. Candidates: Workers KV, Cache API, Upstash Redis.

## Investigation
| Backend | Warm read | Notes |
|---|---|---|
| Workers KV | unmeasured | Durable, `cacheTtl` supported, eventual propagation |
| Cache API | unmeasured | Per-colo in-memory; no cross-colo persistence |
| Upstash Redis | unmeasured | Extra network hop + third-party processor disclosure |

**These are not measurements.** The numbers published in the previous version of this ADR came from a local Node `Map` simulation; Upstash was never reachable and no deployment existed. They have been removed rather than restated.

## Decision
- Workers KV as the source of truth, with `cacheTtl` (3600 s) on bucket reads.
- Bloom blob served from a single versioned key (`slop-filter-bloom`) so a deploy is an atomic swap.
- Cache API is not used; the KV edge cache already covers the hot path.

## Status
- **Implemented:** `packages/edge/handler.ts` reads KV from the Workers `env` binding (`c.env.KV`), not `globalThis`.
- **Implemented:** `packages/edge/scripts/benchmark-edge.ts` (simulation) and `benchmark-edge-real.ts` (real origin, needs `EDGE_ORIGIN`).
- **Not verified:** no latency figure in this repository is measured. `performance.yml` runs the simulation, so its output is not evidence either.
- **Future work:** deploy to staging, run `benchmark-edge-real.ts` per region, cold and warm, and record the results with the date and commit.