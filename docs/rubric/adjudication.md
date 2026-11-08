# Adjudication

Applies when two annotators differ by **≥ 2 points** on any dimension, or when they assign
opposite `harm_proxy_label` values.

## Process

1. Disagreements are collected automatically after both annotations land (no manual triage).
2. A third annotator — not one of the two — sees both ratings and both justifications, but
   **not** which one came first or who wrote it.
3. The adjudicator either picks one rating or writes a new one, with a one-line reason.
4. The pair, the adjudication and the reason are stored; the original ratings are never
   overwritten. Disagreement rate is a first-class output, not a nuisance.

## Recording

```
{clip_id, dimension, rater_a, rater_b, delta, adjudicated, reason, adjudicator_id, ts}
```

## Reporting

- Per-dimension disagreement rate (target < 15 % of clips).
- Cohen's κ for the two-rater case, Krippendorff's α when a clip has ≥ 3 ratings.
- A list of the dimensions where disagreement concentrates. If adjudication keeps landing on
  one anchor, the anchor is wrong — fix the rubric, do not train on the noise.

## Stop conditions

Stop the pilot and rewrite the rubric if any of these hold:

- κ < 0.6 on Narration origin — then `S` cannot be learned from these labels.
- Adjudication rate > 30 % — the anchors are ambiguous.
- Adjudicators systematically agree with the *longer* justification — a sign the reason text
  is doing the work instead of the clip.

## Not yet done

No pilot has run. No κ or α exists. Any number appearing in a report before this section is
replaced with real output must be treated as invented.