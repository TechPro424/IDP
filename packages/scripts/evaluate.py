#!/usr/bin/env python3
"""Evaluate a frozen test set.

Input: CSV with columns `label` (0/1) and `score` (0-1, higher = more slop).
Output: JSON with per-quadrant precision/recall/F1, AUROC, PR-AUC and bootstrap CIs.

No defaults, no placeholders: if the data is missing this exits non-zero rather than
printing numbers somebody might quote (plan §14.5).
"""
import argparse
import json
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_fscore_support, roc_auc_score


def bootstrap_auroc(y: np.ndarray, s: np.ndarray, n: int = 1000, seed: int = 0):
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if len(np.unique(y[idx])) < 2:
            continue
        values.append(roc_auc_score(y[idx], s[idx]))
    return (float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5)))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="CSV with label,score[,quadrant]")
    ap.add_argument("--out", required=True)
    ap.add_argument("--tau", type=float, default=0.5, help="decision threshold on score")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    if not {"label", "score"}.issubset(df.columns):
        print("error: CSV must contain 'label' and 'score' columns", file=sys.stderr)
        return 2

    y = df["label"].to_numpy(int)
    s = df["score"].to_numpy(float)
    yhat = (s >= args.tau).astype(int)

    p, r, f1, _ = precision_recall_fscore_support(y, yhat, average="binary", zero_division=0)
    result = {
        "n": int(len(y)),
        "tau": args.tau,
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "auroc": float(roc_auc_score(y, s)) if len(np.unique(y)) > 1 else None,
        "auroc_ci95": list(bootstrap_auroc(y, s)) if len(np.unique(y)) > 1 else None,
        "pr_auc": float(average_precision_score(y, s)),
    }

    if "quadrant" in df.columns:
        per_q = {}
        for q, g in df.groupby("quadrant"):
            yq, sq = g["label"].to_numpy(int), g["score"].to_numpy(float)
            pq, rq, fq, _ = precision_recall_fscore_support(
                yq, (sq >= args.tau).astype(int), average="binary", zero_division=0
            )
            per_q[str(q)] = {"n": int(len(g)), "precision": float(pq), "recall": float(rq), "f1": float(fq)}
        result["per_quadrant"] = per_q

    with open(args.out, "w") as fh:
        json.dump(result, fh, indent=2)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())