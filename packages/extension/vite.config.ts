import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: 'packages/extension/background.js',
        popup: 'packages/extension/popup.html',
        content: 'packages/extension/content.ts',
        options: 'packages/extension/options.html',
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        // use imported fs and path
        const src = path.resolve(__dirname, 'manifest.json');
        const dest = path.resolve(__dirname, 'dist', 'manifest.json');
        fs.copyFileSync(src, dest);
      },
    },
  ],
});
