// Unit tests for the content script's state machine (plan §7.2, §11).
// The content script itself needs a browser; these pieces are pure.
import { nextPhase, pickActiveVideo, rememberVerdict, recallVerdict, forgetVerdicts, type Phase } from '../state.js';

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${(err as Error).message}`);
    failures++;
  }
}
const eq = (actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`expected ${b}, got ${a}`);
};

check('phase order follows the plan', () => {
  const ctx = { edgeConfigured: true };
  let p: Phase = 'IDLE';
  p = nextPhase(p, 'video-observed', ctx);
  eq(p, 'OBSERVED');
  p = nextPhase(p, 'cache-check', ctx);
  eq(p, 'CACHE_CHECK');
  p = nextPhase(p, 'bloom-check', ctx);
  eq(p, 'BLOOM');
  p = nextPhase(p, 'scoring-start', ctx);
  eq(p, 'SCORING');
  p = nextPhase(p, 'scoring-done', ctx);
  eq(p, 'VERDICT');
  p = nextPhase(p, 'ui-shown', ctx);
  eq(p, 'UI');
  p = nextPhase(p, 'dismissed', ctx);
  eq(p, 'OBSERVED');
});

check('no edge configured skips the BLOOM leg', () => {
  const ctx = { edgeConfigured: false };
  const p = nextPhase(nextPhase('IDLE', 'video-observed', ctx), 'bloom-check', ctx);
  eq(p, 'OBSERVED');
});

check('an event that would move backwards is ignored', () => {
  const ctx = { edgeConfigured: true };
  eq(nextPhase('SCORING', 'cache-check', ctx), 'SCORING');
  eq(nextPhase('SCORING', 'video-observed', ctx), 'SCORING');
  eq(nextPhase('UI', 'cache-check', ctx), 'UI');
});

check('a fresh video id leaves SCORING alone', () => {
  eq(nextPhase('SCORING', 'video-observed', { edgeConfigured: false }), 'SCORING');
  eq(nextPhase('UI', 'video-observed', { edgeConfigured: false }), 'OBSERVED');
});

check('pickActiveVideo prefers the playing element over a larger loaded one', () => {
  const idx = pickActiveVideo([
    { readyState: 4, paused: true, ended: false, currentTime: 12, width: 1920, height: 1080 }, // preloaded neighbour
    { readyState: 4, paused: false, ended: false, currentTime: 3, width: 640, height: 360 }, // playing
  ]);
  eq(idx, 1);
});

check('pickActiveVideo ignores unloaded and zero-size elements', () => {
  const idx = pickActiveVideo([
    { readyState: 1, paused: false, ended: false, currentTime: 1, width: 640, height: 360 },
    { readyState: 4, paused: false, ended: false, currentTime: 1, width: 0, height: 0 },
  ]);
  eq(idx, -1);
});

check('pickActiveVideo falls back to the largest loaded element', () => {
  const idx = pickActiveVideo([
    { readyState: 4, paused: true, ended: false, currentTime: 0, width: 320, height: 180 },
    { readyState: 4, paused: true, ended: true, currentTime: 90, width: 1280, height: 720 },
  ]);
  eq(idx, 1);
});

check('a verdict is recalled for a video seen earlier in the session', () => {
  forgetVerdicts();
  rememberVerdict('abc', { verdict: 'REVIEW', srs: 0.7, reasons: [{ label: 'x', value: 'y' }] });
  eq(recallVerdict('abc')?.verdict, 'REVIEW');
  eq(recallVerdict('other'), null);
  forgetVerdicts();
  eq(recallVerdict('abc'), null);
});

if (failures) {
  console.error(`${failures} state test(s) failed`);
  process.exit(1);
}
console.log('State machine tests passed');
