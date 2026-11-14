// Writes packages/features/features.config.json from the TypeScript source of
// truth (plan §7.1 wants one config file for browser, Node and Python).
// Usage: node --loader ts-node/esm packages/features/scripts/export-config.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from '../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../features.config.json');
writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log(`wrote ${out}`);
