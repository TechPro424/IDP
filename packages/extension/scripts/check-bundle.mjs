// Post-build guard: MV3 content scripts are classic scripts, so the bundle
// must not contain ESM syntax; and every file the manifest references must
// actually exist. Run automatically by `postbuild`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems = [];

const content = fs.readFileSync(path.join(dist, 'content.js'), 'utf8');
if (/^\s*(import|export)[\s{*]/m.test(content)) problems.push('content.js contains ESM syntax (must be a classic script)');

const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const referenced = [
  manifest.background?.service_worker,
  manifest.options_page,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
].filter(Boolean);
for (const file of referenced) {
  if (!fs.existsSync(path.join(dist, file))) problems.push(`manifest references missing file: ${file}`);
}

if (problems.length) {
  console.error('extension bundle check failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// Budgets (plan §11 / Phase 6). Content-script size is the closest static proxy
// for main-thread cost; CPU and frame drops are measured by hand (see
// docs/manual-smoke.md) because measuring them needs a browser.
const CONTENT_JS_BUDGET = 60 * 1024;
if (Buffer.byteLength(content) > CONTENT_JS_BUDGET) {
  console.error(
    `extension bundle check failed:\n - content.js is ${content.length}b, over the ${CONTENT_JS_BUDGET}b budget`,
  );
  process.exit(1);
}

// The whole point of the browser-safe rewrite: no Node built-ins may be bundled
// into shipped code (a `node:fs` import in the content script broke the whole
// extension in an earlier revision).
const built = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) built.push(full);
  }
};
walk(dist);
for (const file of built) {
  const body = fs.readFileSync(file, 'utf8');
  const hit = body.match(/from\s*["']node:[a-z_]+["']|require\(\s*["']node:[a-z_]+["']\s*\)/);
  if (hit) problems.push(`${path.relative(dist, file)} bundles a Node built-in (${hit[0]})`);
}
if (problems.length) {
  console.error('extension bundle check failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}

console.log(
  `extension bundle ok (${referenced.length} manifest entries, ${built.length} js files, content.js ${content.length}b/${CONTENT_JS_BUDGET}b)`,
);
