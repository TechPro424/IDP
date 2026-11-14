// Shared feature extraction — browser-safe entry point.
// No node:fs / node:zlib imports anywhere in this module graph.
import type { AudioInput, AudioFeatures } from './audio.js';
import { extractAudioFeatures } from './audio.js';
import { VisualAnalyzer, type VisualFeatures } from './visual.js';
import { extractTextFeatures, type TextFeatures } from './text.js';

export { config } from './config.js';
export type { FeatureConfig } from './config.js';
export { VisualAnalyzer } from './visual.js';
export type { VisualFeatures } from './visual.js';
export { extractTextFeatures } from './text.js';
export type { TextFeatures } from './text.js';
export { extractAudioFeatures } from './audio.js';
export type { AudioInput, AudioFeatures } from './audio.js';
export * from './hash.js';

export interface FeatureResult {
  audio?: AudioFeatures;
  visual?: VisualFeatures;
  text?: TextFeatures;
}

/**
 * Extract the full feature vector.
 * @param input of type {Float32Array, number, number}
 * @param frames optional sequence of ImageData-like frames for visual analysis
 * @param text optional caption/transcript text
 */
export async function extractFeatures(
  input: AudioInput,
  frames?: any[],
  text?: string,
): Promise<FeatureResult> {
  const audio = await extractAudioFeatures(input);

  let visual: VisualFeatures | undefined;
  if (frames && frames.length > 0) {
    const analyzer = new VisualAnalyzer(6);
    for (const frame of frames) analyzer.analyzeFrame(frame);
    visual = analyzer.getResult();
  }

  let textFeatures: TextFeatures | undefined;
  if (text) textFeatures = await extractTextFeatures(text);

  return { audio, visual, text: textFeatures };
}
