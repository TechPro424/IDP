import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// MV3 content scripts are classic scripts: no static ESM imports, no shared
// chunks. So the content script is built as a self-contained IIFE and the
// worker/pages as ES modules — two passes, selected by --mode.
const copyManifest: Plugin = {
  name: 'copy-manifest',
  closeBundle() {
    const dest = path.resolve(__dirname, 'dist', 'manifest.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, 'manifest.json'), dest);
  },
};

export default defineConfig(({ mode }) =>
  mode === 'pages'
    ? {
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          rollupOptions: {
            input: {
              background: path.resolve(__dirname, 'background.ts'),
              popup: path.resolve(__dirname, 'popup.html'),
              options: path.resolve(__dirname, 'options.html'),
            },
            output: {
              format: 'es',
              entryFileNames: '[name].js',
              chunkFileNames: 'chunks/[name]-[hash].js',
              assetFileNames: '[name][extname]',
            },
          },
        },
        plugins: [copyManifest],
      }
    : {
        build: {
          outDir: 'dist',
          emptyOutDir: true,
          lib: {
            entry: path.resolve(__dirname, 'content.ts'),
            formats: ['iife'],
            name: 'SlopFilterContent',
            fileName: () => 'content.js',
          },
        },
        plugins: [copyManifest],
      },
);
