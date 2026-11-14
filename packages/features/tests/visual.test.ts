import { VisualAnalyzer } from '../src/visual.js';

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

(() => {
  const analyzer = new VisualAnalyzer(6);
  const dark = () => solidColor(640, 360, 100, 100, 100);
  const light = () => solidColor(640, 360, 200, 200, 200);

  // 10 dark, 10 light (cut #1), 10 dark (cut #2).
  const seq = [...Array(10).fill(dark()), ...Array(10).fill(light()), ...Array(10).fill(dark())];
  for (const f of seq) analyzer.analyzeFrame(f);

  const result = analyzer.getResult();
  console.log('Visual test result:', result);
  if (result.shotCount !== 2) throw new Error(`Expected 2 shots, got ${result.shotCount}`);
  if (result.staticFrameRatio < 0 || result.staticFrameRatio > 1) throw new Error('Static ratio out of range');
  if (result.cutsPerMinute <= 0) throw new Error('cutsPerMinute should be positive');
  if (result.colorHistogram.length === 0) throw new Error('Missing color histogram');

  // A static clip should register zero cuts.
  const staticAnalyzer = new VisualAnalyzer(6);
  for (let i = 0; i < 20; i++) staticAnalyzer.analyzeFrame(dark());
  if (staticAnalyzer.getResult().shotCount !== 0) throw new Error('Static clip produced a cut');
  console.log('Visual tests passed.');
})();
