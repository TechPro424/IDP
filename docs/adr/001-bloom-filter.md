# ADR 001: Bloom Filter Parameters

## Context
The client asks "is this URL prefix known-slop?" before doing anything expensive. A Bloom
filter answers negatives for free and is safe to ship to the client as a versioned blob.

## Decision
- **Sizing is computed, not hardcoded:** `optimalParameters(n, p)` →
  `m = ceil(-n ln p / (ln 2)²)`, `k = round(m/n · ln 2)`. At the default
  `n = 10 000, p = 0.001` that is ≈ 143 776 bits (17.5 kB) with `k = 10` hashes.
- **Double hashing (Kirsch–Mitzenmacher):** one FNV-1a and one Murmur3-finalizer hash produce
  `k` indices as `h1 + i·h2 (mod m)`. `h2` is forced odd and then `>>> 0`; without the
  unsigned coercion it can be negative and produce out-of-range indices — a silent
  false-negative bug that was found and fixed in `packages/bloom/src/index.ts`.
- **Wire format:** 12-byte header (`magic 0x42463031 "BF01"`, `sizeBits`, `hashCount`) followed
  by the bit array, so a client can reject a blob from a different implementation instead of
  misreading garbage.
- **One key per version** (`slop_filter_bloom`), served from `GET /v1/bloom/latest` with
  `X-Bloom-Version` and `Cache-Control: public, max-age=86400`. Publishing a new filter is an
  atomic key write; clients cache by version string.
- **Read-only from the client.** There is no `POST` that mutates the filter. Buckets are
  written by the operator, offline.

## Why not the previous design
The earlier version used a fixed 1 000 000-bit filter with 2 hashes stored as JSON and
mutated via POST. That gave a much worse false-positive rate at a larger size, and it let any
caller write into shared state.

## Consequences
- Clients do a local membership test first, so a Bloom-negative video causes **no** per-video
  network request at all.
- A false positive costs one padded bucket fetch and can only push ALLOW → REVIEW.
- The blob is downloaded once per version; ~18 kB is acceptable.

## Status
- **Implemented** — `packages/bloom/src/index.ts`, wired through `packages/edge/handler.ts`
  and `packages/extension/edge.ts`.
- **Verified** — `packages/edge/tests/bloom.test.ts` measures a false-positive rate of 0.0012
  against a target of 0.001 at n = 10 000, and asserts no false negatives including across a
  `toBinary`/`fromBinary` round trip.