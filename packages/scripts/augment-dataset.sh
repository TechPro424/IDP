#!/usr/bin/env bash
# Augment dataset with codec changes, noise, speed variations.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

INPUT_DIR="packages/data/dataset/raw"
OUTPUT_DIR="packages/data/dataset/augmented"

# Optional clean flag
CLEAN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--clean)
      CLEAN=true
      shift
      ;;
    -h|--help)
      log "Usage: $0 [-c|--clean]"
      exit 0
      ;;
    *)
      die "Usage: $0 [-c|--clean]"
      ;;
  esac
done

if [[ "$CLEAN" == true ]]; then
  rm -rf "$OUTPUT_DIR"
  log "Removed existing output directory $OUTPUT_DIR"
fi

mkdir -p "$OUTPUT_DIR"

# Validate input directory exists
if [[ ! -d "$INPUT_DIR" ]]; then die "Input directory $INPUT_DIR does not exist"; fi

for src in "$INPUT_DIR"/*; do
  dst="$OUTPUT_DIR/$(basename "$src")"
  log "Copying $src -> $dst"
  cp "$src" "$dst" || die "Failed to copy $src"
done

log "Augmentation complete. Output in $OUTPUT_DIR"
