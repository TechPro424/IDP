# Threat Model

Scope: the browser extension (`packages/extension`), the edge worker (`packages/edge`), and
the data flow between them. Out of scope: YouTube's own player, Cloudflare's platform.

| # | Asset | Adversary | Vector | Impact if exploited | Mitigation in this repo | Residual risk |
|---|---|---|---|---|---|---|
| T1 | Watch history | Edge operator / network observer | Prefix requests logged server-side | Reconstructable viewing interests over time | Only a 20-bit prefix is sent; Bloom-negative videos produce no request; no cookies, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` | Prefixes are linkable per client; an operator with logs and a candidate URL list can confirm matches. Not solved by design. |
| T2 | Full URL / video id | Malicious edge origin | Extension configured to a hostile origin | Full browsing disclosure | Origin requires an explicit `chrome.permissions.request`; empty by default; code path sends only `h[0:5]` | A user can be socially engineered into setting a hostile origin. Documented, not prevented. |
| T3 | Verdict integrity | Poisoned edge data | Attacker adds benign prefixes to the slop bucket, or suppresses real ones | False advisories / false negatives | Edge is **corroboration only**: local scoring must also fire before BLOCK; a bucket hit can only raise ALLOW → REVIEW | No signed manifests yet (open item). |
| T4 | Occupancy inference | Anyone querying the edge | Bucket size reveals how many videos share a prefix | Corpus-size leakage | Every bucket is padded to 32 entries with decoy suffixes (`padBucket`) | Padding is uniform, so entry *format* is uniform; count leakage is removed. |
| T5 | Extension integrity | Malicious page | DOM clobbering, event hijacking of the overlay | Spoofed advisory or hidden button | Overlay lives in a **closed** Shadow DOM attached to `documentElement`; no page-readable hooks; no `innerHTML` from page data | A page could still cover the overlay visually. Advisory-only design limits the payoff. |
| T6 | Extension pages | Injected script | XSS in popup/options | Theft of annotations | `script-src 'self'; object-src 'self'` CSP; no `eval`, no remote code; all text set via `textContent` | — |
| T7 | User data at rest | Local attacker / shared machine | Reading `chrome.storage.local` or IndexedDB | Local behavioural profile | Opt-in, no sync, one-click delete of all local data | Not encrypted at rest; a local attacker with profile access reads it. |
| T8 | Availability | Abuse of the worker | Request flooding | Cost / DoS | Input validated (`/^[0-9a-f]{4,16}$/`), responses cached 1 h | **No rate limiting implemented.** Must be configured at the Cloudflare zone/rule level before any public deployment. |
| T9 | Model / dataset poisoning | Compromised training data | Crafted annotations skew thresholds | Systematic mis-scoring | Thresholds chosen on validation only; model version string invalidates client caches | No dataset provenance tooling yet (open item). |
| T10 | Supply chain | Compromised dependency | Malicious package in the lockfile | Arbitrary code in the extension | pnpm lockfile committed; small dependency set (Meyda, Hono, Vite) | No automated `pnpm audit` gate in CI yet (open item). |

## Dispute channel

There is no way for a creator to appeal, because the extension never publishes, reports or
blocks anything: it shows an advisory to the person watching and nothing else. If that ever
changes, a dispute path becomes mandatory. The intended shape: a public list of
BLOOM entries with reason codes, a takedown route, and an SLA, plus a signed manifest so
clients can detect suppression.

## Adversarial robustness

Not yet tested. The evaluation plan (`slop-filter-implementation-plan.md` §9.5) lists codec
re-encoding, added noise, background music, playback speed and music-only clips as required
transforms. None of these runs today; the `fixtures/` directory holds only a feature golden
file.