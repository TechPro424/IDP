// Builds an IIFE bundle of the feature library so a browser test can load the
// exact same code the extension ships. Used by tests/browser/parity.spec.ts.
import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  root,
  configFile: false,
  logLevel: 'error',
  build: {
    outDir: '.parity',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: path.join(root, 'src/index.ts'),
      formats: ['iife'],
      name: 'SlopFeatures',
      fileName: () => 'features.iife.js',
    },
  },
});

console.log(`parity bundle written to ${path.join(root, '.parity/features.iife.js')}`);