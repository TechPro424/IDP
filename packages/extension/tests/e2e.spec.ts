import { test, expect } from './fixtures.js';

// Same constraint as content.spec.ts: the extension fixtures need a Chromium
// that can load unpacked extensions.
test.skip(process.env.SLOP_E2E_FULL !== '1', 'set SLOP_E2E_FULL=1 to run against a loaded extension');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// End-to-end checks for the local-first extension: opt-in gating, local
// persistence, and the absence of any hard-coded network origin.

test('popup refuses to enable the filter without consent', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const enable = page.getByLabel('Enable filter');
  await expect(enable).toBeVisible();
  await expect(enable).not.toBeChecked();

  await enable.check();
  await expect(page.locator('#status')).toContainText('consent');
  await expect(enable).not.toBeChecked();
});

test('options page stores settings locally and persists them', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByLabel('I understand and consent').check();
  await page.getByLabel('Enable the filter').check();
  await page.getByLabel('Save Settings').click();
  await expect(page.locator('#status')).toHaveText('Settings saved.');

  await page.reload();
  await expect(page.getByLabel('I understand and consent')).toBeChecked();
  await expect(page.getByLabel('Enable the filter')).toBeChecked();
});

test('manifest requests no third-party host permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../dist/manifest.json'), 'utf8'));
  expect(manifest.host_permissions).toEqual(['https://www.youtube.com/*']);
  expect(manifest.permissions).not.toContain('tabCapture');
});
