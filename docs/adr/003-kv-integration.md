# ADR 003: KV Integration for Edge Worker

**Context**
- Edge worker must persist block list and Bloom filter.
- Cloudflare Workers KV is used for durable storage.

**Decision**
- Use a KV namespace named `KV_NAMESPACE` injected into the worker.
- Keys are prefixes, values are the string `'true'`.
- Bloom filter stored as JSON under key `slop_filter_bloom`.
- On startup, load Bloom filter from KV; if missing, create new.
- After each POST, persist Bloom filter.

**Rationale**
- KV provides strong consistency and persistence across restarts.
- Storing Bloom filter as JSON avoids serialization overhead.
- Using string `'true'` keeps KV simple and fast.

**Status**
- Implemented in `packages/edge/handler.ts`.  ✅
