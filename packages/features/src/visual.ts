// Visual feature extraction utilities
// Down-sample an ImageData to a small 64x36 grayscale array
// and compute basic shot‑boundary metrics.

export interface VisualFeatures {
  shotCount: number;
  staticFrameRatio: number; // frames without a shot
  avgShotIntervalFrames: number; // average number of frames between shots
}

// Convert to grayscale (optionally down‑sample if needed)
function toGrayscale(imgData: any, width: number, height: number): Uint8Array {
  // If the image is already the target size, just use its data
  if (imgData.width === width && imgData.height === height) {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = imgData.data[i * 4];
      const g = imgData.data[i * 4 + 1];
      const b = imgData.data[i * 4 + 2];
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return gray;
  }
  // Fallback: simply use the first width*height pixels
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = imgData.data[i * 4];
    const g = imgData.data[i * 4 + 1];
    const b = imgData.data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

// Updated usage

export class VisualAnalyzer {
  private prevGray?: Uint8Array;
  private shotCount = 0;
  private staticFrames = 0;
  private diffThreshold = 30; // luminance diff threshold per pixel
  private frameRate: number;
  private shotFrames: number[] = [];

  constructor(frameRate: number = 30) {
    this.frameRate = frameRate;
  }

  analyzeFrame(imgData: any): void {
    const gray = toGrayscale(imgData, 64, 36);
    if (this.prevGray) {
      let diffSum = 0;
      for (let i = 0; i < gray.length; i++) {
        diffSum += Math.abs(gray[i] - this.prevGray[i]);
      }
      const diffAvg = diffSum / gray.length;
      if (diffAvg > this.diffThreshold) {
        this.shotCount++;
        this.shotFrames.push(this.shotFrames.length);
      } else {
        this.staticFrames++;
      }
    }
    this.prevGray = gray;
  }

  getResult(): VisualFeatures {
    const totalFrames = this.shotFrames.length + this.staticFrames;
    const staticRatio = totalFrames > 0 ? this.staticFrames / totalFrames : 1;
    const avgInterval = this.shotCount > 1
      ? (totalFrames - 1) / (this.shotCount - 1)
      : 0;
    return {
      shotCount: this.shotCount,
      staticFrameRatio: staticRatio,
      avgShotIntervalFrames: avgInterval,
    };
  }
}

export class VisualAnalyzer {
  private prevGray?: Uint8Array;
  private shotCount = 0;
  private staticFrames = 0;
  private diffThreshold = 30; // luminance diff threshold per pixel
  private frameRate: number;
  private shotFrames: number[] = [];

  constructor(frameRate: number = 30) {
    this.frameRate = frameRate;
  }

  analyzeFrame(imgData: ImageData): void {
    const gray = downsampleToGrayscale(imgData, 64, 36);
    if (this.prevGray) {
      let diffSum = 0;
      for (let i = 0; i < gray.length; i++) {
        diffSum += Math.abs(gray[i] - this.prevGray[i]);
      }
      const diffAvg = diffSum / gray.length;
      if (diffAvg > this.diffThreshold) {
        this.shotCount++;
        this.shotFrames.push(this.frameRate * this.shotFrames.length / this.frameRate); // store frame index? not used
      } else {
        this.staticFrames++;
      }
    }
    this.prevGray = gray;
  }

  getResult(): VisualFeatures {
    const totalFrames = this.shotFrames.length + this.staticFrames;
    const staticRatio = totalFrames > 0 ? this.staticFrames / totalFrames : 1;
    const avgInterval = this.shotCount > 1
      ? (totalFrames - 1) / (this.shotCount - 1)
      : 0;
    return {
      shotCount: this.shotCount,
      staticFrameRatio: staticRatio,
      avgShotIntervalFrames: avgInterval,
    };
  }
}
