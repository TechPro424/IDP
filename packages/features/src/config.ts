// Feature-extraction configuration — single source of truth.
// Browser-safe: no node:fs / JSON file loading (the old config.json needed readFileSync).
export interface FeatureConfig {
  audio: {
    frameSize: number;
    hopSize: number;
    /** RMS above which a frame counts as voiced/speech. */
    rmsThreshold: number;
    /** Frames shorter than this many ms are merged into a pause. */
    minPauseMs: number;
    /** Below this many seconds of speech the audio modality is `missing`. */
    minSpeechSeconds: number;
    /**
     * Rate lab audio is resampled to so Node and the browser agree (plan §7.1).
     * The extension ignores this and uses the AudioContext rate.
     */
    labSampleRate: number;
  };
  visual: {
    downsampleWidth: number;
    downsampleHeight: number;
    /** Minimum consecutive frames between two shot boundaries. */
    minShotLengthFrames: number;
    /** How many std-devs above the running mean counts as a shot. */
    shotThresholdSigma: number;
    /** Absolute minimum mean-luma delta to call a cut (guards warmup). */
    shotAbsFloor: number;
    /** Exponential moving average factor for the adaptive threshold. */
    adaptiveAlpha: number;
    /** Luma histogram bins (0..255 split evenly). */
    histogramBins: number;
  };
  hashing: {
    /** Hex chars kept as the server-side prefix (plan P). */
    prefixLength: number;
    /** Hex chars kept as the client-side suffix check (plan Q). */
    suffixLength: number;
  };
}

export const config: FeatureConfig = {
  audio: {
    frameSize: 2048,
    hopSize: 512,
    rmsThreshold: 0.05,
    minPauseMs: 200,
    minSpeechSeconds: 5,
    labSampleRate: 48000,
  },
  visual: {
    downsampleWidth: 64,
    downsampleHeight: 36,
    minShotLengthFrames: 3,
    shotThresholdSigma: 3,
    shotAbsFloor: 12,
    adaptiveAlpha: 0.1,
    histogramBins: 8,
  },
  hashing: {
    prefixLength: 5,
    suffixLength: 11,
  },
};

export default config;
