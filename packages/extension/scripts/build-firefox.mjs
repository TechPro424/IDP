// Produce a Firefox-flavoured copy of dist/ (Firefox MV3 has no service_worker
// and wants an explicit add-on id). Chrome's dist/ is left untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist');
const dest = path.join(root, 'dist-firefox');

if (!fs.existsSync(path.join(src, 'manifest.json'))) {
  console.error('dist/manifest.json not found — run `pnpm run build` first.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
const worker = manifest.background?.service_worker;
if (!worker) {
  console.error('expected a background.service_worker entry in manifest.json');
  process.exit(1);
}
delete manifest.minimum_chrome_version;
manifest.background = { scripts: [worker], type: 'module' };
manifest.browser_specific_settings = {
  gecko: { id: 'slop-filter@localhost', strict_min_version: '121.0' },
};

fs.writeFileSync(path.join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`firefox build ready: ${path.relative(root, dest)}`);
console.log('load it with: web-ext run --source-dir dist-firefox   (or about:debugging)');