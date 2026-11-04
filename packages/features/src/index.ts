// Shared feature extraction utilities (audio, visual, text)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ----- Configuration -----
const CONFIG_PATH = fileURLToPath(new URL('./config.json', import.meta.url));
export const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Config;
export interface Config {
  audio: {
    minSpeechSeconds: number;
  };
  visual: {
    downsampleWidth: number;
    downsampleHeight: number;
  };
}

// ----- Feature Types -----
export interface FeatureResult {
  audio?: AudioFeatures;
  visual?: VisualFeatures;
  text?: TextFeatures;
}
export interface AudioFeatures {
  syntheticLikelihood?: number;
  missing?: boolean;
  avgFlatness?: number;
  avgCentroid?: number;
  avgPitch?: number;
}
import { VisualAnalyzer, type VisualFeatures } from './visual.js';
import { type TextFeatures as TF, extractTextFeatures } from './text.js';
export type TextFeatures = TF;
export { VisualAnalyzer };
export type { VisualFeatures };
export { extractTextFeatures };

// ----- Input Type -----
export interface AudioInput {
  data: Float32Array; // interleaved mono data
  sampleRate: number;
}

// ----- Feature Extraction -----
// @ts-ignore
import Meyda from 'meyda';
import { computeRMS, computePitch } from './audio.js';

export function extractFeatures(input: AudioInput, imageData?: any, text?: string): FeatureResult {
  const { data, sampleRate } = input;
  const durationSec = data.length / sampleRate;
  const { minSpeechSeconds } = config.audio;

  // Meyda for spectral features
  const frameSize = 1024;
  const hopSize = 512; // 50% overlap
  const meydaObj = (Meyda as any).default || Meyda;
  meydaObj.bufferSize = frameSize;
  meydaObj.hopSize = hopSize;
  meydaObj.sampleRate = sampleRate;

  let voicedFrames = 0;
  let totalFrames = 0;
  let flatnessSum = 0;
  let centroidSum = 0;
  let pitchSum = 0;
  let pitchFrames = 0;

  for (let i = 0; i + frameSize <= data.length; i += hopSize) {
    const frame = data.slice(i, i + frameSize);
    const rms = computeRMS(frame);
    if (rms > 0.05) voicedFrames++;

    const features: any = meydaObj.extract ? meydaObj.extract(['spectralFlatness', 'spectralCentroid'], frame) : {};
    flatnessSum += features?.spectralFlatness ?? 0;
    centroidSum += features?.spectralCentroid ?? 0;

    const pitch = computePitch(frame, sampleRate);
    if (!isNaN(pitch)) {
      pitchSum += pitch;
      pitchFrames++;
    }
    totalFrames++;
  }

  const voicedRatio = totalFrames > 0 ? voicedFrames / totalFrames : 0;
  const syntheticLikelihood = Math.min(1, Math.max(0, voicedRatio * 2));
  const missing = durationSec < minSpeechSeconds;

  const avgFlatness = totalFrames > 0 ? flatnessSum / totalFrames : 0;
  const avgCentroid = totalFrames > 0 ? centroidSum / totalFrames : 0;
  const avgPitch = pitchFrames > 0 ? pitchSum / pitchFrames : NaN;

  // Visual analysis
  let visual: VisualFeatures | undefined;
  if (imageData) {
    const visualAnalyzer = new VisualAnalyzer(30);
    visualAnalyzer.analyzeFrame(imageData);
    visual = visualAnalyzer.getResult();
  }

  // Text analysis
  let textFeatures: TextFeatures | undefined;
  if (text) {
    textFeatures = extractTextFeatures(text);
  }

  return {
    audio: {
      syntheticLikelihood,
      missing,
      avgFlatness,
      avgCentroid,
      avgPitch,
    },
    visual,
    text: textFeatures,
  };
}
