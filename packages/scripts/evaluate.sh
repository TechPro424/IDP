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

# Dummy evaluation logic – replace with real script
# e.g., python -m evaluate --data "$TEST_DATA"

if [[ "$DRY_RUN" == true ]]; then
  log "[dry-run] Would evaluate data at $TEST_DATA"
  exit 0
fi

# Simulated metrics
PREC=0.85
REC=0.80
AUROC=0.90

TIMESTAMP=$(date +%Y%m%d%H%M%S)
REPORT_DIR="results/report-$TIMESTAMP"
mkdir -p "$REPORT_DIR"

if [[ "$JSON" == true ]]; then
  cat <<EOF > "$REPORT_DIR/metrics.json"
{
  "precision": $PREC,
  "recall": $REC,
  "auroc": $AUROC
}
EOF
  log "Metrics written to $REPORT_DIR/metrics.json"
else
  cat <<EOF > "$REPORT_DIR/metrics.txt"
Precision: $PREC
Recall: $REC
AUROC: $AUROC
EOF
  log "Metrics written to $REPORT_DIR/metrics.txt"
fi

log "Evaluation complete. Report in $REPORT_DIR"
