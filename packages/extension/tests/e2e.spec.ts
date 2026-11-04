import { test, expect } from './fixtures.js';
import type { Route } from '@playwright/test';

// End‑to‑end test for the Slop Filter extension
// Verifies popup UI and that network calls are made.

test('extension popup UI and network calls', async ({ page, context, extensionId }) => {
  // Intercept network requests made by the extension background service worker
  const bucketRequests: string[] = [];
  await context.route('https://example.com/v1/bucket/*', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      bucketRequests.push('POST:' + req.url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'added' }) });
    } else {
      bucketRequests.push('GET:' + req.url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: 'ALLOW' }) });
    }
  });

  // Navigate directly to the extension popup page
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Wait for popup to appear
  const enableCheckbox = page.getByLabel('Enable filter');
  await expect(enableCheckbox).toBeVisible();

  // Interact with UI elements
  const prefixInput = page.locator('#prefix');
  await prefixInput.fill('test-prefix');

  const addBtn = page.locator('#addBtn');
  await addBtn.click();

  // Wait for the POST request to be recorded
  await expect.poll(() => bucketRequests).toContain('POST:https://example.com/v1/bucket/test-prefix');

  // Click Bloom POST button
  const bloomBtn = page.locator('#bloomBtn');
  await bloomBtn.click();

  await expect.poll(() => bucketRequests.filter(r => r === 'POST:https://example.com/v1/bucket/test-prefix').length).toBe(2);
});
