#!/usr/bin/env python3
"""Train, calibrate and export the fusion model.

Expects real, generator/speaker-disjoint CSVs — there is no synthetic fallback.
Refusing to fabricate training data is the point (plan §14.5).

    train.csv, val.csv  columns: label,S,H

Output JSON matches `packages/scoring/src/model.ts`:

    {"coefficients": {"S": .., "H": .., "SH": ..}, "intercept": .., ...}

The runtime applies a plain logistic on [S, H, S*H]. Calibration is reported for
documentation and for the eventual calibrated-scoring path; it is not silently
assumed to be active.
"""
import argparse
import datetime as dt
import json
import sys

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


def ece(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    total = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi if hi < 1.0 else p <= hi)
        if not m.any():
            continue
        total += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(total)


def load(path: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        sys.exit(f"error: {path} not found. Acquire real data first (plan 9.3/9.4).")
    missing = {"label", "S", "H"} - set(df.columns)
    if missing:
        sys.exit(f"error: {path} is missing columns: {sorted(missing)}")
    if df["label"].nunique() < 2:
        sys.exit(f"error: {path} has a single class — cannot train or evaluate.")
    return df


def design(df: pd.DataFrame) -> np.ndarray:
    s, h = df["S"].to_numpy(float), df["H"].to_numpy(float)
    return np.column_stack([s, h, s * h])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default="packages/data/processed/train.csv")
    ap.add_argument("--val", default="packages/data/processed/val.csv")
    ap.add_argument("--out", default="packages/scoring/model.json")
    ap.add_argument("--seed", type=int, default=1337)
    args = ap.parse_args()

    train, val = load(args.train), load(args.val)
    Xtr, ytr = design(train), train["label"].to_numpy(int)
    Xva, yva = design(val), val["label"].to_numpy(int)

    lr = LogisticRegression(max_iter=1000, C=1.0, random_state=args.seed)
    lr.fit(Xtr, ytr)

    raw_val = lr.predict_proba(Xva)[:, 1]
    raw_train = lr.predict_proba(Xtr)[:, 1]

    # Pick the calibrator that actually reduces expected calibration error on val.
    iso = IsotonicRegression(out_of_bounds="clip").fit(raw_train, ytr)
    sig = LogisticRegression(max_iter=1000, random_state=args.seed).fit(raw_train.reshape(-1, 1), ytr)

    candidates = {
        "none": (raw_val, ece(yva, raw_val)),
        "isotonic": (iso.predict(raw_val), ece(yva, iso.predict(raw_val))),
        "sigmoid": (sig.predict_proba(raw_val.reshape(-1, 1))[:, 1], ece(yva, sig.predict_proba(raw_val.reshape(-1, 1))[:, 1])),
    }
    best = min(candidates, key=lambda k: candidates[k][1])

    model = {
        "coefficients": {
            "S": float(lr.coef_[0][0]),
            "H": float(lr.coef_[0][1]),
            "SH": float(lr.coef_[0][2]),
        },
        "intercept": float(lr.intercept_[0]),
        "calibration": best,
        "ece": {k: round(v[1], 4) for k, v in candidates.items()},
        "seed": args.seed,
        "nTrain": int(len(train)),
        "nVal": int(len(val)),
        "trainedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "featureOrder": ["S", "H", "S*H"],
    }

    with open(args.out, "w") as fh:
        json.dump(model, fh, indent=2)

    print(f"wrote {args.out}")
    print(f"  n_train={model['nTrain']} n_val={model['nVal']} seed={args.seed}")
    print(f"  ECE: {model['ece']}  chosen={best}")
    print("  NOTE: update ML_MODEL_VERSION in packages/scoring/src/model.ts to match these coefficients.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())