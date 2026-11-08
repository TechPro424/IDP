#!/usr/bin/env bash
# Assemble synthetic and human datasets.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

RAW_DIR="packages/data/dataset/raw"

# Optional dry‑run flag
DRY_RUN=false
while getopts ":d" opt; do
  case $opt in d) DRY_RUN=true ;; *) die "Usage: $0 [-d]" ;; esac
done

mkdir -p "$RAW_DIR"

# Skip existing files unless forced
for file in synthetic_placeholder.txt human_placeholder.txt; do
  target="$RAW_DIR/$file"
  if [[ -f $target && "$DRY_RUN" != true ]]; then
    log "Skipping $target – already exists"
    continue
  fi
  if [[ "$DRY_RUN" == true ]]; then
    log "[dry‑run] Would create $target"
    continue
  fi
  log "Creating $target"
  echo "$file placeholder" > "$target"
done

log "Dataset assembled into $RAW_DIR"
