# ADR 003: KV Integration for the Edge Worker

## Context
The worker must serve one versioned Bloom blob and a set of padded prefix buckets. It must
work under the Workers runtime, where a KV namespace arrives through the `env` binding.

## Decision
- Bind the namespace as **`KV`** in `wrangler.toml` (`[[kv_namespaces]] binding = "KV"`) and
  read it as `c.env.KV` in the Hono handler. Never `globalThis`: there is no such global in a
  Worker, and reading one silently produced `undefined` in the previous implementation.
- **Keys**
  - `slop-filter-bloom` → binary Bloom blob (see ADR 001), read with `type: 'arrayBuffer'`.
  - `bucket:<prefix>` → JSON `{v, mv, p, q, entries[], pad}`, written by the operator tooling.
- **Reads only.** No endpoint mutates KV. `GET /v1/bucket/:prefix` returns the bucket padded to
  32 entries; `GET /v1/bloom/latest` returns the blob with `X-Bloom-Version`.
- **Caching:** `cacheTtl` on bucket reads (3600 s) and `Cache-Control: public, max-age=3600`
  on the response; the blob gets `max-age=86400`.
- **Validation:** `PREFIX_RE = /^[0-9a-f]{4,16}$/`; anything else is a 400 before touching KV.
- **Hygiene:** CORS allow-list, `Set-Cookie` stripped from every response, no request logging.

## Consequences
- The worker holds no mutable state, so a deploy is an atomic key swap and there is no
  read-modify-write race between colos.
- Eventual consistency is tolerable: a client that misses a fresh bucket just keeps its local
  verdict.
- Writers must be offline tools; there is deliberately no admin API in the worker.

## Status
- **Implemented** — `packages/edge/handler.ts`, `packages/edge/index.ts` (`export default { fetch: app.fetch }`), `packages/edge/wrangler.toml`.
- **Verified** — `packages/edge/tests/handler.test.ts` and `kv.test.ts` drive the real
  `createApp` with a mock KV object passed through the `env` argument.
- **Not done** — no deployment exists, so no latency has been measured (ADR 006).
