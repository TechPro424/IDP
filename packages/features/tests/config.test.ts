// Plan §7.1: one config file, consumed by browser, Node and Python.
// `src/config.ts` is the source of truth; this test fails when the JSON artefact
// drifts (regenerate: node --loader ts-node/esm packages/features/scripts/export-config.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from '../src/config.js';

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const jsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../features.config.json');

check('features.config.json matches src/config.ts', () => {
  const onDisk = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const expected = JSON.parse(JSON.stringify(config));
  if (JSON.stringify(onDisk) !== JSON.stringify(expected)) {
    throw new Error('drifted — regenerate with packages/features/scripts/export-config.ts');
  }
});

check('config has a lab sample rate', () => {
  if (config.audio.labSampleRate !== 48000) throw new Error(`expected 48000, got ${config.audio.labSampleRate}`);
});
