# Annotation Rubric

Version 0 (draft). Nothing in this file has been validated with annotators yet — no
agreement statistic exists, so treat every threshold below as a hypothesis to be tested in
the pilot, not as a settled definition.

## Labels

Each clip gets four dimension ratings (1–5) plus one overall judgement.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Attention fragmentation** (`Hatt`) | Long, stable shots; sustained argument | Mixed; some b-roll and cuts | Cut every 1–2 s, zoom-punches, zero dwell |
| **Substance deficit** (`Hsub`) | Specific claims, named sources, numbers | Generic but on-topic | Restates the title, no new information, circular |
| **Narration origin** (`S`) | Clearly a human voice, disfluencies, breath | Ambiguous (heavy processing, or a very polished human) | Clearly synthetic: flat prosody, no breaths, uniform pause length |
| **Epistemic reliability** | Claims are checkable and sourced | Unverifiable but not misleading | Confident false or unfalsifiable claims |

Anchors are deliberately short. If two annotators cannot apply them to the same clip within
one point, the anchor is wrong and gets rewritten before the pilot.

## Derived labels

- `harm_proxy_label = 1` iff **Narration origin ≥ 4 AND Substance deficit ≥ 4** — i.e. the
  clip is machine-narrated *and* says nothing. This is the construct the fusion model is
  trained on; it is a proxy, not a measure of harm.
- `slop_label = 1` iff `Attention fragmentation ≥ 4 AND harm_proxy_label = 1`.
- `S = (Narration origin − 1) / 4`, `Hatt = (Attention fragmentation − 1) / 4`,
  `Hsub = (Substance deficit − 1) / 4` — the same [0,1] scale the extension produces.

## Annotation procedure

1. Watch once at normal speed, without pausing. Rate Narration origin and Substance deficit.
2. Watch a second time, scrubbing only if needed, and rate Attention fragmentation.
3. Rate Epistemic reliability last, after a short break, so the other ratings do not anchor it.
4. Write one sentence of justification per 1 or 5. A 1 or 5 without a justification is
   returned to the annotator.
5. Never consult the extension's own verdict. If the clip came from the extension's cache,
   the verdict must be stripped before it reaches the annotator.

## Blinding and order

- Clips are shuffled per annotator with a fixed seed derived from the annotator id.
- Each clip is annotated by at least two annotators.
- Annotators do not see each other's ratings, and do not see the model's score.

## Known problems with v0

- "Epistemic reliability" requires domain knowledge; we do not have a subject-matter panel.
  Expect low agreement and consider dropping the dimension to a separate, later study.
- "Clearly synthetic" is going to blur with "heavily processed human" as TTS improves.
  The pilot must measure how often annotators disagree there; if κ < 0.6 the dimension is
  not usable and the whole `S` target needs rethinking.
- No language/accent coverage yet. A rubric validated on English only must not be shipped as
  if it were universal.