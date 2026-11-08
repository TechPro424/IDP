#!/usr/bin/env bash
# Run evaluation on frozen test set and output metrics.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

DRY_RUN=false
JSON=false
TEST_DATA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -j|--json)
      JSON=true
      shift
      ;;
    -h|--help)
      log "Usage: $0 [-d|--dry-run] [-j|--json] [test_data_path]"
      exit 0
      ;;
    -*)
      die "Usage: $0 [-d|--dry-run] [-j|--json] [test_data_path]"
      ;;
    *)
      if [[ -z "$TEST_DATA" ]]; then
        TEST_DATA="$1"
      else
        die "Unexpected argument: $1"
      fi
      shift
      ;;
  esac
done

TEST_DATA=${TEST_DATA:-tests/frozen_test_set}

if [[ ! -d "$TEST_DATA" ]]; then
  if [[ "$TEST_DATA" == "tests/frozen_test_set" ]]; then
    mkdir -p "$TEST_DATA"
  else
    die "Test data directory not found: $TEST_DATA"
  fi
fi

if [[ "$DRY_RUN" == true ]]; then
  log "[dry-run] Would evaluate data at $TEST_DATA"
  exit 0
fi

if [[ ! -f "$TEST_DATA/labels.csv" ]]; then
  die "No labelled test set at $TEST_DATA/labels.csv - refusing to emit metrics (never invent measurements, plan 14.5)."
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
REPORT_DIR="results/report-$TIMESTAMP"
mkdir -p "$REPORT_DIR"

python3 packages/scripts/evaluate.py --data "$TEST_DATA/labels.csv" --out "$REPORT_DIR/metrics.json"

if [[ "$JSON" == false ]]; then
  python3 - "$REPORT_DIR/metrics.json" <<'SUMPY'
import json, sys
m = json.load(open(sys.argv[1]))
print(f"n={m['n']} tau={m['tau']}")
print(f"Precision: {m['precision']:.3f}")
print(f"Recall:    {m['recall']:.3f}")
print(f"F1:        {m['f1']:.3f}")
print(f"AUROC:     {m['auroc']}  CI95={m['auroc_ci95']}")
print(f"PR-AUC:    {m['pr_auc']:.3f}")
for q, v in m.get("per_quadrant", {}).items():
    print(f"  [{q}] n={v['n']} P={v['precision']:.3f} R={v['recall']:.3f} F1={v['f1']:.3f}")
SUMPY
fi

log "Evaluation complete. Report in $REPORT_DIR"
