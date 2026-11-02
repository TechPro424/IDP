#!/usr/bin/env bash
# Compute final thresholds from validation data.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { log "$*" >&2; exit 1; }

# Load defaults or override via env
TASS=${TASS:-0.65}
TAH=${TAH:-0.60}

# Basic sanity check using bc
if ! command -v bc &>/dev/null; then die "bc required for numeric checks"; fi
if (( $(echo "$TASS < 0 || $TASS > 1" | bc -l) )); then die "tauS out of bounds (0-1)"; fi
if (( $(echo "$TAH < 0 || $TAH > 1" | bc -l) )); then die "tauH out of bounds (0-1)"; fi

# Ensure jq is available
if ! command -v jq &>/dev/null; then die "jq required to build JSON"; fi

jq -n --arg tS "$TASS" --arg tH "$TAH" \
  '{tauS: ($tS|tonumber), tauH: ($tH|tonumber)}' \
  > packages/scoring/thresholds.json

log "Thresholds written to packages/scoring/thresholds.json"
