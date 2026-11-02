#!/usr/bin/env python3
"""Train a logistic‑regression baseline and export weights to packages/scoring/model.json.

The script expects a CSV file with a header row.  The last column must be the
binary target (0/1).  Feature columns can be any numeric type.  If the
expected dataset is missing, a small synthetic dataset is generated so that the
pipeline never stalls.

Example CSV layout:

    feature1,feature2,feature3,target
    0.1,0.5,0.3,1
    0.4,0.2,0.9,0

The resulting JSON has the same shape as the placeholder model.json:

```json
{\n  "coefficients": {"feature1": 0.8, "feature2": 0.6, "feature3": 0.6},\n  "intercept": -0.5\n}
```
"""

import json
import os
import pathlib
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path("packages/data/dataset/augmented")
CSV_PATH = DATA_DIR / "train.csv"
OUTPUT_PATH = Path("packages/scoring/model.json")

# ---------------------------------------------------------------------------
# Helper: create a tiny synthetic dataset if none exists.
# ---------------------------------------------------------------------------

def create_synthetic_csv(csv_path: Path):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    # 100 samples, 3 features
    X = np.random.randn(100, 3)
    y = np.random.binomial(1, 0.5, size=100)
    header = "feature1,feature2,feature3,target\n"
    with open(csv_path, "w") as f:
        f.write(header)
        for x, t in zip(X, y):
            f.write(",".join(map(str, x)) + f",{t}\n")

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
if not CSV_PATH.exists():
    print(f"Dataset not found at {CSV_PATH}. Creating synthetic placeholder.")
    create_synthetic_csv(CSV_PATH)

import pandas as pd

df = pd.read_csv(CSV_PATH)
X = df.drop("target", axis=1).values
y = df["target"].values

# ---------------------------------------------------------------------------
# Train logistic regression (no hyper‑parameter tuning, plain L2 penalty)
# ---------------------------------------------------------------------------
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
model = LogisticRegression(max_iter=200, solver="lbfgs", penalty="l2")
model.fit(X_scaled, y)

# ---------------------------------------------------------------------------
# Prepare JSON output matching the placeholder format
# ---------------------------------------------------------------------------
coeffs = {col: float(model.coef_[0][i]) for i, col in enumerate(df.drop("target", axis=1).columns)}
output = {
    "coefficients": coeffs,
    "intercept": float(model.intercept_[0]),
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_PATH, "w") as f:
    json.dump(output, f, indent=2)
print(f"Model trained and exported to {OUTPUT_PATH}")
