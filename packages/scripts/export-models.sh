#!/usr/bin/env bash
# Export logistic regression model weights to a distribution folder.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

MODEL_JSON="packages/scoring/model.json"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
OUT_DIR="packages/scoring/dist/$TIMESTAMP"
mkdir -p "$OUT_DIR"

# Optional force flag
FORCE=false
while getopts ":f" opt; do
  case $opt in f) FORCE=true ;; *) die "Usage: $0 [-f]" ;; esac
done

# Prevent accidental overwrite
if [[ -f "$MODEL_JSON" ]]; then
  log "Copying $MODEL_JSON to $OUT_DIR/"
  cp "$MODEL_JSON" "$OUT_DIR/"
else
  die "Model file $MODEL_JSON not found"
fi

log "Model exported to $OUT_DIR/$(basename $MODEL_JSON)"

# Compute checksum
checksum=$(sha256sum "$OUT_DIR/$(basename $MODEL_JSON)" | cut -d' ' -f1)
echo "$checksum  $(basename $MODEL_JSON)" > "$OUT_DIR/checksum.txt"
log "Checksum written to $OUT_DIR/checksum.txt"
