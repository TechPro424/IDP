#!/usr/bin/env bash
# Compute tau_s / tau_h from validation data only (never from the test set).
set -euo pipefail

VAL=${VAL:-packages/data/processed/val.csv}
OUT=${OUT:-packages/scoring/thresholds.json}
FLOOR=${PRECISION_FLOOR:-0.85}

if [[ ! -f "$VAL" ]]; then
  echo "error: $VAL not found — thresholds must come from validation data (plan §9.3)." >&2
  exit 1
fi

python3 packages/scripts/compute-thresholds.py --val "$VAL" --out "$OUT" --precision-floor "$FLOOR"

echo "Thresholds written to $OUT"
echo "Now copy tauS/tauH into packages/extension/settings.ts defaults and record the commit."