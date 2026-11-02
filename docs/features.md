# Feature Dictionary

The **Slop Filter** extracts three families of features from a media stream:

| Feature | Description | Units | Typical Range |
|---------|-------------|-------|---------------|
| **Audio** | 1‑D spectral features derived from a short audio window. | Float32 array (length 256) | 0.0–1.0 |
| **Visual** | Down‑sampled grayscale histogram of frames. | Float32 array (length 64) | 0–255 |
| **Text** | Bag‑of‑words embedding of subtitle or transcript snippets. | Float32 array (length 128) | 0–1 |

Each feature vector is normalized to a `[0, 1]` range and passed to the scoring model. The exact extraction logic lives in `packages/features/src/*.ts` and can be inspected for the algorithmic details.

---

> **Note:** The feature vectors are *not* persisted; they are streamed to the scoring module in the extension and sent to the edge service for Bloom‑filter lookups.
