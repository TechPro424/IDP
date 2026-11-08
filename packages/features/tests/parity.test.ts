// Golden-file parity check: guards the shared feature code against silent
// drift between the Node pipeline and the browser bundle (both import this
// exact module). Run with UPDATE_GOLDEN=1 to (re)generate the fixture.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { extractFeatures } from '../src/index.js';

const goldenPath = fileURLToPath(new URL('../../../fixtures/features-golden.json', import.meta.url));

// Deterministic pseudo-random signal (seeded LCG) so every run is identical.
function seededSignal(n: number): Float32Array {
  const out = new Float32Array(n);
  let state = 123456789;
  for (let i = 0; i < n; i++) {
    state = (1103515245 * state + 12345) & 0x7fffffff;
    const noise = (state / 0x7fffffff) * 2 - 1;
    out[i] = Math.sin((2 * Math.PI * 220 * i) / 48000) * 0.4 + noise * 0.05;
  }
  return out;
}

function frame(v: number) {
  const img = { width: 64, height: 36, data: new Uint8ClampedArray(64 * 36 * 4) };
  for (let i = 0; i < 64 * 36; i++) {
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  return img;
}

(async () => {
  const sampleRate = 48000;
  const result = await extractFeatures(
    { data: seededSignal(sampleRate * 5), sampleRate },
    [frame(10), frame(120), frame(10), frame(10)],
    'Deterministic caption text for the golden fixture. Deterministic caption text again.',
  );

  // Only compare finite numeric leaves.
  const flatten = (obj: any, prefix = ''): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'number') { if (Number.isFinite(v)) out[key] = v; }
      else if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    }
    return out;
  };
  const actual = flatten(result);

  if (!existsSync(goldenPath) || process.env.UPDATE_GOLDEN === '1') {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + '\n');
    console.log(`Parity golden written to ${goldenPath}`);
    return;
  }

  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<string, number>;
  const failures: string[] = [];
  for (const [key, expected] of Object.entries(golden)) {
    const got = actual[key];
    if (got === undefined) { failures.push(`${key}: missing (golden ${expected})`); continue; }
    const tol = Math.max(1e-6, Math.abs(expected) * 1e-3);
    if (Math.abs(got - expected) > tol) failures.push(`${key}: ${got} != ${expected}`);
  }
  if (failures.length) throw new Error('Golden parity mismatch:\n' + failures.join('\n'));
  console.log(`Parity test passed (${Object.keys(golden).length} features).`);
})();
