# ADR 001: Bloom‑Filter Parameters

**Context**
- The edge worker uses a Bloom filter to quickly reject prefixes that are likely blocked.
- Size and hash count need to balance false positives and memory.

**Decision**
- Use a 1 000 000‑bit filter (≈125 kB) with 2 hash functions.
- Store the filter as JSON in KV under key `slop_filter_bloom`.
- On each POST, add to filter and persist.
- On GET, test filter first; if false, fall back to KV.

**Rationale**
- 1 M bits gives a low false‑positive rate for ~10k entries.
- Two hash functions provide adequate dispersion without extra computation.
- Persisting to KV allows state to survive worker restarts.

**Status**
- Implemented in `packages/edge/bloomFilter.ts` and `handler.ts`.  ✅
