import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, 'background.ts'),
        popup: path.resolve(__dirname, 'popup.html'),
        content: path.resolve(__dirname, 'content.ts'),
        options: path.resolve(__dirname, 'options.html'),
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
        const src = path.resolve(__dirname, 'manifest.json');
        const dest = path.resolve(__dirname, 'dist', 'manifest.json');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      },
    },
  ],
});
