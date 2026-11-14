// Cross-check of the shot detector against an independent implementation.
//
// Plan §7.1 asks for the shot detector to be cross-checked against
// PySceneDetect on lab clips. PySceneDetect is not installable here (no network),
// so this uses ffmpeg's own scene-change filter instead: a different algorithm,
// different implementation, same question.
//
// Fixture: 60 synthetic 64x36 gray frames at 6 fps with hard cuts at frames 20
// and 40, plus a slow 6-frame ramp (50..55) that neither detector should report
// as two separate shots.
import { VisualAnalyzer } from '../src/visual.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const W = 64;
const H = 36;
const N = 60;
const FPS = 6;
const CUTS = [20, 40];

function frames(): Array<{ width: number; height: number; data: Uint8ClampedArray }> {
  return Array.from({ length: N }, (_, i) => {
    let lvl = i < 20 ? 32 : i < 40 ? 200 : 90;
    if (i >= 50 && i < 56) lvl = Math.round(90 + ((200 - 90) * (i - 50)) / 5);
    const data = new Uint8ClampedArray(W * H * 4);
    for (let p = 0; p < W * H; p++) {
      data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = lvl;
      data[p * 4 + 3] = 255;
    }
    return { width: W, height: H, data };
  });
}

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Frames where ffmpeg's scene detector fires, using a threshold of 0.1. */
function ffmpegCuts(framesList: Array<{ data: Uint8ClampedArray }>): number[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-cuts-'));
  const raw = path.join(dir, 'frames.raw');
  const clip = path.join(dir, 'clip.mp4');
  try {
    fs.writeFileSync(raw, Buffer.concat(framesList.map((f) => Buffer.from(f.data).filter((_, i) => i % 4 === 0))));
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', String(FPS), '-i', raw,
       '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p', clip],
      { stdio: 'ignore' },
    );
    const out = execFileSync(
      'ffmpeg',
      ['-i', clip, '-filter:v', "select='gt(scene,0.1)',metadata=print:file=-", '-an', '-f', 'null', '-'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return out
      .split('\n')
      .filter((l) => l.includes('pts_time:'))
      .map((l) => Math.round(parseFloat(l.split('pts_time:')[1]) * FPS));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let failures = 0;
function check(name: string, fn: () => boolean | void): void {
  try {
    if (fn() === false) throw new Error('assertion returned false');
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}: ${(err as Error).message}`);
  }
}

const framesList = frames();
const analyzer = new VisualAnalyzer(FPS);
for (const f of framesList) analyzer.analyzeFrame(f);
const ours = analyzer.getResult();

check('the fixture has the two intended hard cuts, plus at most the ramp', () => {
  // Both hard cuts must be found, and nothing may be hallucinated: the ramp is
  // allowed to count once, so three is the ceiling.
  if (ours.shotCount < CUTS.length) throw new Error(`detected only ${ours.shotCount} cuts`);
  if (ours.shotCount > CUTS.length + 1) throw new Error(`detected ${ours.shotCount} cuts, expected at most 3`);
});

check('a static clip produces no cuts at all', () => {
  const still = new VisualAnalyzer(FPS);
  const frame = frames()[0];
  for (let i = 0; i < 30; i++) still.analyzeFrame(frame);
  if (still.getResult().shotCount !== 0) {
    throw new Error(`detected ${still.getResult().shotCount} cuts in a static clip`);
  }
});

if (!hasFfmpeg()) {
  console.warn('WARNING: ffmpeg not installed - the shot-detector cross-check did NOT run');
} else {
  const theirs = ffmpegCuts(framesList);

  check('ffmpeg finds both hard cuts', () => {
    for (const cut of CUTS) {
      if (!theirs.some((f) => Math.abs(f - cut) <= 1)) {
        throw new Error(`ffmpeg cuts ${JSON.stringify(theirs)} miss frame ${cut}`);
      }
    }
  });

  check('our detector and ffmpeg agree on the hard-cut count', () => {
    const hardCuts = theirs.filter((f) => CUTS.some((c) => Math.abs(f - c) <= 1)).length;
    if (hardCuts !== 2) throw new Error(`ffmpeg reported ${hardCuts} hard cuts`);
    // Bounded on both sides: a detector that fires on every frame is as wrong as
    // one that misses cuts.
    const extra = ours.shotCount - hardCuts;
    if (extra < 0) throw new Error(`we reported ${ours.shotCount}, ffmpeg found ${hardCuts} cuts`);
    if (extra > 1) throw new Error(`we reported ${ours.shotCount} cuts against ffmpeg's ${hardCuts}`);
  });
}

console.log('Shot-detector cross-check:', failures === 0 ? 'passed' : `${failures} FAILURES`);
if (failures) process.exit(1);