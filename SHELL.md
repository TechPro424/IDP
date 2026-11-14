# Shell‑Script Improvement Checklist

Below is a consolidated set of recommendations for each script in the `packages/scripts` directory.  These suggestions are aimed at making the scripts more **robust**, **maintainable**, and suitable for **production** use.

---

## 1. `assemble-dataset.sh`

| Issue | Suggested Fix | Rationale |
|-------|--------------|-----------|
| No idempotency | Skip creating files if they already exist. | Prevents accidental overwrites. |
| No logging helper | Add `log()` function. | Consistent output formatting. |
| No dry‑run mode | Add `--dry-run` flag to preview actions. | Safeguard against destructive changes. |
| No input validation | Ensure target directory exists before creating files. | Avoids silent failures. |
| No environment checks | Verify required utilities (`curl`, `wget`) if later added. | Early error detection. |

### Quick implementation sketch
```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*"; }

INPUT_DIR="packages/data/dataset/raw"
mkdir -p "$INPUT_DIR"

for file in synthetic_placeholder.txt human_placeholder.txt; do
  target="$INPUT_DIR/$file"
  if [[ -f $target && "$1" != "--force" ]]; then
    log "Skipping $target – already exists"
    continue
  fi
  log "Creating $target"
  echo "$file placeholder" > "$target"
done

echo "Dataset assembled into $INPUT_DIR"
```

---

## 2. `augment-dataset.sh`

| Issue | Suggested Fix | Rationale |
|-------|--------------|-----------|
| No validation of input/output dirs | Check existence of `INPUT_DIR` and create `OUTPUT_DIR`. | Prevents crashes. |
| No clean flag | Add `--clean` to delete output before starting. | Removes stale data. |
| No progress logging | Use `tee` or `log()` for each file processed. | Easier debugging. |
| No error handling | `set -euo pipefail` and wrap `cp` in a function that aborts on failure. | Ensures reliable copy. |
| No augmentation placeholder | Add comment to indicate where real augmentation will go. | Documentation. |

### Quick implementation sketch
```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*"; }

INPUT_DIR="packages/data/dataset/raw"
OUTPUT_DIR="packages/data/dataset/augmented"

# Clean output if requested
if [[ "$1" == "--clean" ]]; then
  rm -rf "$OUTPUT_DIR"
fi
mkdir -p "$OUTPUT_DIR"

for src in "$INPUT_DIR"/*; do
  dst="$OUTPUT_DIR/$(basename "$src")"
  log "Copying $src -> $dst"
  cp "$src" "$dst" || die "Failed to copy $src"
done

echo "Augmentation complete. Output in $OUTPUT_DIR"
```

---

## 3. `export-models.sh`

| Issue | Suggested Fix | Rationale |
|-------|--------------|-----------|
| No overwrite protection | Add `--force` flag or prompt before overwriting. | Avoid accidental loss. |
| No checksum | Compute SHA‑256 of the exported file. | Integrity verification. |
| No timestamped output | Create `dist/<YYYYMMDD>` folder. | Versioning. |
| No error handling | Wrap copy in a function and check exit status. | Reliability. |

### Quick implementation sketch
```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*"; }

MODEL_JSON="packages/scoring/model.json"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
OUT_DIR="packages/scoring/dist/$TIMESTAMP"
mkdir -p "$OUT_DIR"

cp "$MODEL_JSON" "$OUT_DIR/"
log "Model exported to $OUT_DIR/$(basename $MODEL_JSON)"

# Checksum
sha256sum "$OUT_DIR/$(basename $MODEL_JSON)" > "$OUT_DIR/checksum.txt"
log "Checksum written to $OUT_DIR/checksum.txt"
```

---

## 4. `compute-thresholds.sh`

| Issue | Suggested Fix | Rationale |
|-------|--------------|-----------|
| Hard‑coded values | Allow reading from a config file or environment variables. | Flexibility. |
| No JSON construction helper | Use `jq` for clean JSON. | Avoid shell quoting bugs. |
| No validation | Verify that thresholds are numbers in (0,1). | Prevent invalid config. |
| No exit code on failure | Return `1` on invalid input. | CI integration. |

### Quick implementation sketch
```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*"; }

# Load defaults or override via env
TASS=${TASS:-0.65}
TAH=${TAH:-0.60}

# Basic sanity check
if (( $(echo "$TASS < 0 || $TASS > 1" | bc -l) )); then die "tauS out of bounds"; fi
if (( $(echo "$TAH < 0 || $TAH > 1" | bc -l) )); then die "tauH out of bounds"; fi

jq -n --arg tS "$TASS" --arg tH "$TAH" \
  '{tauS: ($tS|tonumber), tauH: ($tH|tonumber)}' \
  > packages/scoring/thresholds.json
log "Thresholds written to packages/scoring/thresholds.json"
```

---

## 5. `evaluate.sh`

| Issue | Suggested Fix | Rationale |
|-------|--------------|-----------|
| No test data path | Accept an argument or default to a known location. | Reusability. |
| No real evaluation | Call a Python/Node script that runs the model and calculates metrics. | Accuracy. |
| No logging | Pipe output to `tee` and write a log file. | Traceability. |
| No JSON output | Provide a `--json` flag that outputs metrics in JSON. | CI consumption. |
| No versioned report | Create a timestamped report directory. | Historical record. |

### Quick implementation sketch
```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*"; }

TEST_DATA=${1:-tests/frozen_test_set}
if [[ ! -d $TEST_DATA ]]; then die "Test data not found: $TEST_DATA"; fi

# Run actual evaluation (placeholder call)
# python -m evaluate --data "$TEST_DATA"

# Dummy metrics for now
PREC=0.85
REC=0.80
AUROC=0.90

TIMESTAMP=$(date +%Y%m%d%H%M%S)
REPORT_DIR="results/report-$TIMESTAMP"
mkdir -p "$REPORT_DIR"

cat <<EOF > "$REPORT_DIR/metrics.txt"
Precision: $PREC
Recall: $REC
AUROC: $AUROC
EOF

log "Evaluation complete. Results written to $REPORT_DIR/metrics.txt"
```

---

## General Best Practices for All Scripts

| Practice | Why | How to Apply |
|----------|-----|--------------|
| **Shebang + `set -euo pipefail`** | Immediate exit on error, treat unset vars as errors. | Add at top of every script. |
| **Centralised logging** | Consistent output, easier debugging. | Define `log()` and `die()` once in a helper file or inline. |
| **Option parsing** | Flexible command‑line usage. | Use `getopts` or a small wrapper. |
| **Idempotence** | Safe reruns. | Skip existing files or add `--force`. |
| **Dry‑run support** | Prevent accidental changes. | Add a `--dry-run` flag that only prints actions. |
| **Environment checks** | Early failure when dependencies missing. | `command -v` checks for `jq`, `curl`, `ffmpeg`, etc. |
| **Versioned output** | Keeps history of artifacts. | Timestamped directories or files. |
| **Checksum / hash** | Verify integrity. | `sha256sum` on exported files. |
| **JSON handling with `jq`** | Avoid shell quoting bugs. | Build JSON files with `jq`. |
| **Exit codes** | CI integration. | Return `0` on success, non‑zero on error. |
| **Documentation** | Future maintainers. | Add comments or a README section explaining the script. |

---

**Next Steps**

1. Replace the placeholder logic in each script with the suggested patterns. 2. Run the scripts in a clean environment to ensure they work idempotently. 3. Add unit tests (e.g., with `bats` or `shunit2`) to catch regressions. 4. Integrate the scripts into CI pipelines (`.github/workflows/*.yml`).

---

*This file should be kept in sync with any future changes to the scripts.*
