import { VisualAnalyzer } from '../src/visual';

// Helper to create solid color ImageData
function solidColor(width: number, height: number, r: number, g: number, b: number, a: number = 255): any {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  }
  return { width, height, data };
}

function delay(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

// Test basic shot detection
(async () => {
  const analyzer = new VisualAnalyzer(30);
  const frame1 = solidColor(640, 360, 100, 100, 100);
  const frame2 = solidColor(640, 360, 200, 200, 200); // large difference
  const frame3 = solidColor(640, 360, 100, 100, 100);

  analyzer.analyzeFrame(frame1);
  analyzer.analyzeFrame(frame2);
  analyzer.analyzeFrame(frame3);

  const result = analyzer.getResult();
  console.log('Visual test result:', result);
  if (result.shotCount !== 2) throw new Error('Expected 2 shots');
  if (result.staticFrameRatio < 0 || result.staticFrameRatio > 1) throw new Error('Static ratio out of range');
  console.log('Visual tests passed.');
})();
