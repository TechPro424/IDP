// Visual feature extraction. Browser-safe plain DSP over downsampled frames.
import { config } from './config.js';
import { mean, variance } from './audio.js';

export interface VisualFeatures {
  shotCount: number;
  staticFrameRatio: number;
  avgShotIntervalFrames: number;
  cutsPerMinute: number;
  asiMeanFrames: number;
  asiCV: number;
  meanInterFrameDiff: number;
  colorHistogram: number[];
}

function toGrayscale(imgData: any, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  const src = imgData.data;
  for (let i = 0; i < width * height; i++) {
    out[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }
  return out;
}

function lumaHistogram(gray: Uint8Array, bins: number): number[] {
  const hist = new Array(bins).fill(0);
  for (let i = 0; i < gray.length; i++) {
    hist[Math.min(bins - 1, (gray[i] * bins) >> 8)]++;
  }
  const total = gray.length || 1;
  return hist.map((c) => c / total);
}

export class VisualAnalyzer {
  private prevGray?: Uint8Array;
  private shotCount = 0;
  private staticFrames = 0;
  private framesSeen = 0;
  private lastShotFrame = 0;
  private shotIntervals: number[] = [];
  private diffSums: number[] = [];
  private diffs: number[] = [];
  private histSum: number[];
  private frameRate: number;
  private runningMean = 0;
  private runningM2 = 0;

  constructor(frameRate: number = 6) {
    this.frameRate = frameRate;
    this.histSum = new Array(config.visual.histogramBins).fill(0);
  }

  analyzeFrame(imgData: any): void {
    const { downsampleWidth: w, downsampleHeight: h, histogramBins } = config.visual;
    const gray = toGrayscale(imgData, w, h);
    this.framesSeen++;

    if (!this.prevGray) {
      this.prevGray = gray;
      const hist = lumaHistogram(gray, histogramBins);
      for (let i = 0; i < hist.length; i++) this.histSum[i] += hist[i];
      return;
    }

    let diffSum = 0;
    for (let i = 0; i < gray.length; i++) diffSum += Math.abs(gray[i] - this.prevGray[i]);
    const diffAvg = diffSum / gray.length;
    this.diffSums.push(diffAvg);
    this.diffs.push(diffAvg);

    // Adaptive threshold from stats observed BEFORE this frame, with an
    // absolute floor so warmup frames don't produce false cuts.
    const n = this.diffs.length - 1;
    const std = n > 1 ? Math.sqrt(this.runningM2 / (n - 1)) : 0;
    const threshold = Math.max(config.visual.shotAbsFloor, this.runningMean + config.visual.shotThresholdSigma * std);

    // Welford update (exclude the current diff when computing the threshold above).
    const delta = diffAvg - this.runningMean;
    this.runningMean += delta / this.diffs.length;
    this.runningM2 += delta * (diffAvg - this.runningMean);

    const sinceLastShot = this.framesSeen - this.lastShotFrame;
    if (diffAvg > threshold && sinceLastShot >= config.visual.minShotLengthFrames) {
      this.shotCount++;
      if (this.lastShotFrame > 0) this.shotIntervals.push(sinceLastShot);
      this.lastShotFrame = this.framesSeen;
    } else {
      this.staticFrames++;
    }

    const hist = lumaHistogram(gray, histogramBins);
    for (let i = 0; i < hist.length; i++) this.histSum[i] += hist[i];
    this.prevGray = gray;
  }

  getResult(): VisualFeatures {
    const analyzed = this.shotIntervals.length + this.staticFrames;
    const staticRatio = analyzed > 0 ? this.staticFrames / analyzed : 1;
    const avgInterval = this.shotIntervals.length ? mean(this.shotIntervals) : 0;
    const durationMin = this.framesSeen / this.frameRate / 60;
    const cutsPerMinute = durationMin > 0 ? this.shotCount / durationMin : 0;
    const asiCV = avgInterval > 0 ? Math.sqrt(variance(this.shotIntervals)) / avgInterval : 0;
    return {
      shotCount: this.shotCount,
      staticFrameRatio: staticRatio,
      avgShotIntervalFrames: avgInterval,
      cutsPerMinute,
      asiMeanFrames: avgInterval,
      asiCV,
      meanInterFrameDiff: this.diffSums.length ? mean(this.diffSums) : 0,
      colorHistogram: this.framesSeen ? this.histSum.map((v) => v / this.framesSeen) : this.histSum,
    };
  }
}
