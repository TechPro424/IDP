import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The parity spec loads the Vite IIFE bundle, so it has to be current - a stale
// bundle silently tests the previous revision of the library.
export default function globalSetup(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  execFileSync('node', ['scripts/build-parity-bundle.mjs'], { cwd: root, stdio: 'inherit' });
}
