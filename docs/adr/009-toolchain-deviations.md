# ADR 009 — Toolchain and layout deviations from the plan

Status: accepted (recorded 2026-11-07, plan §14.3).

The plan's §5 stack table and §6 repository layout name several tools that were
not used. Each is a deliberate choice, not an omission, and each is justified
below. Everything else in the stack table is in place.

| Plan | Used instead | Why |
|---|---|---|
| WXT (fallback Vite + `@crxjs/vite-plugin`) | plain Vite, two-pass build (`vite.config.ts` `--mode content` / `--mode pages`) + `scripts/build-firefox.mjs` | WXT and crxjs both wanted to own the manifest; this repo generates two build passes and one manifest checker (`scripts/check-bundle.mjs`) in ~60 lines, and the two-pass split is needed anyway because MV3 content scripts are classic scripts and cannot import shared chunks |
| Vitest + Workers pool | `ts-node` assertion scripts, run through `pnpm test` | The Workers pool needs a browser-like runtime; the tests here need a `KV` stub and Hono's `app.request`, which is a plain fetch call. 17 suites, no runner config to maintain |
| ESLint + Prettier + Ruff + pytest | `tsc --noEmit` (TypeScript, strict) as the only gate | The plan's linting rationale is catching mistakes; strict TS catches the type-level ones, and the Python scripts are small, fail-closed and covered by the CI "assert they fail without data" step. Adding ESLint/Ruff is a real follow-up if the team grows |
| Hydra + uv, MLflow | `argparse` scripts, `requirements.txt`, results written to `results/` | The pipeline is linear (features → train → thresholds → evaluate) with four entry points; a config framework and a tracking server would be more moving parts than the pipeline. Reproducibility comes from `--seed` plus the frozen test set |
| PySceneDetect for the shot-detection cross-check | ffmpeg `select='gt(scene,0.1)'` scene filter (`packages/features/tests/ffmpeg-cuts.test.ts`) | PySceneDetect cannot be installed offline (`pip` has no network here). ffmpeg is a different implementation of the same idea, already required for corpus decoding, so the check is independent rather than absent. Swap in PySceneDetect on a lab machine if the thresholds need matching"
| Label Studio for lab annotation | extension annotation mode | One annotation surface only; the plan already requires the extension form for in-the-wild items, and the lab items reuse the same rubric fields |
| `docs/decisions/`, `docs/spikes/`, `docs/compliance/`, `research/` | `docs/adr/001-009` (spike reports are ADRs 004-006), `docs/license_audit.md`, `packages/data` + `packages/scripts` | Same content, flatter tree. Spike reports live with the decisions they produced instead of in a separate folder |

Consequences:

- Anything that reads the plan's file paths must translate them; the mapping is
  in this table.
- No ESLint means style is convention-only. Reviewed by hand.
- No MLflow means runs are identified by seed and by the exported model JSON
  (`packages/scripts/export-models.sh` adds a `sha256sum`).
