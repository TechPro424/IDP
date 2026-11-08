# Compliance Register

Honest status. `✅` = verifiable in the repo, `⚠️` = partial, `❌` = not met.
Nothing here is self-certified without a path to check it.

| Item | Requirement | Status | Evidence / gap |
|---|---|---|---|
| Data minimisation | Only a hash prefix leaves the device | ✅ | `packages/features/src/hash.ts`, `packages/extension/edge.ts` — only `h[0:5]` is requested |
| Default offline | No network unless configured | ✅ | `edgeOrigin` defaults to `''`; with it empty nothing is fetched |
| Consent | Explicit, revocable opt-in | ✅ | `packages/extension/settings.ts` (`consent`, `enabled`), popup gate |
| Local storage only | No `chrome.storage.sync` | ✅ | grep shows no `.sync` usage |
| Deletion | One-click delete of all local data | ✅ | `deleteAllLocalData()` clears storage + IndexedDB; options button |
| Privacy notice | Public, matches behaviour | ✅ | `docs/privacy_notice.md`, incl. the linkability limitation |
| Threat model | Table with mitigations and residual risk | ✅ | `docs/threat_model.md` |
| Accessibility | ARIA labels, keyboard operable, reduced motion | ⚠️ | Labels on every control and a `reduce-motion` setting; no full keyboard-trap/focus-return audit, no high-contrast theme |
| Third-party network calls | None | ✅ | No origin besides the optional user-set edge |
| Remote code | None | ✅ | CSP `script-src 'self'`, no dynamic imports of remote URLs |
| Rate limiting at the edge | Configured before public deployment | ❌ | Not implemented in `packages/edge/handler.ts`; must be set at the Cloudflare zone |
| Dependency audit | Automated | ❌ | No `pnpm audit` step in `.github/workflows/ci.yml` |
| Dataset licenses | Register with URL, license, use, retention | ❌ | `docs/license_audit.md` is a stub; no datasets acquired |
| Annotation consent | Recorded per annotator | ⚠️ | `annotationConsent` setting exists; no annotator-level record |
| Dispute channel | Documented | ❌ | Not applicable while the extension is advisory-only, but must exist before any publish/block capability |
| Accuracy claims | Backed by measurement | ⚠️ | No accuracy claim is made anywhere now; `evaluate.sh` contains hardcoded placeholder metrics that must not be quoted |