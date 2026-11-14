#!/usr/bin/env python3
"""Choose tau_s/tau_h from validation scores only.

Input CSV: label,S,H  (label 0/1)
Grid-searches tau_s and tau_h maximising F1, subject to a precision floor, and
writes packages/scoring/thresholds.json.

There are no default thresholds: if the validation file is absent this exits
non-zero rather than inventing numbers.
"""
import argparse
import itertools
import json
import sys

import numpy as np
import pandas as pd


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", default="packages/data/processed/val.csv")
    ap.add_argument("--out", default="packages/scoring/thresholds.json")
    ap.add_argument("--precision-floor", type=float, default=0.85)
    ap.add_argument("--gray-band", type=float, default=0.1)
    args = ap.parse_args()

    try:
        df = pd.read_csv(args.val)
    except FileNotFoundError:
        sys.exit(f"error: {args.val} not found — thresholds must come from validation data (plan 9.3).")

    if not {"label", "S", "H"}.issubset(df.columns):
        sys.exit("error: validation CSV must contain label,S,H")

    y = df["label"].to_numpy(int)
    S, H = df["S"].to_numpy(float), df["H"].to_numpy(float)
    if y.min() == y.max():
        sys.exit("error: validation set has a single class.")

    best = None
    grid = np.round(np.arange(0.30, 0.91, 0.01), 2)
    for ts, th in itertools.product(grid, grid):
        pred = (S >= ts) & (H >= th)
        tp = int(np.sum(pred & (y == 1)))
        fp = int(np.sum(pred & (y == 0)))
        fn = int(np.sum(~pred & (y == 1)))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        if precision < args.precision_floor:
            continue
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        if best is None or f1 > best["f1"]:
            best = {"tauS": float(ts), "tauH": float(th), "precision": precision, "recall": recall, "f1": f1}

    if best is None:
        sys.exit(
            f"error: no (tauS, tauH) reaches precision >= {args.precision_floor}; "
            "the model is not usable at that operating point."
        )

    best["grayBand"] = args.gray_band
    best["nVal"] = int(len(df))
    best["precisionFloor"] = args.precision_floor
    with open(args.out, "w") as fh:
        json.dump(best, fh, indent=2)

    print(f"wrote {args.out}: tauS={best['tauS']} tauH={best['tauH']} "
          f"P={best['precision']:.3f} R={best['recall']:.3f} F1={best['f1']:.3f} on n={best['nVal']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())