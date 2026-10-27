import { test, expect } from '@playwright/test';

// End‑to‑end test for the Slop Filter extension
// Verifies popup UI and that network calls are made.

test('extension popup UI and network calls', async ({ page }) => {
  // Intercept network requests to the fake backend
  const bucketRequests: string[] = [];
  await page.route('https://example.com/v1/bucket/*', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      bucketRequests.push('POST:' + req.url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'added' }) });
    } else {
      bucketRequests.push('GET:' + req.url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: 'ALLOW' }) });
    }
  });

  // Open a page to trigger the extension icon
  await page.goto('https://example.com');

  // Click the extension icon to open popup
  const extensionIcon = await page.getByLabel('Slop Filter');
  await expect(extensionIcon).toBeVisible();
  await extensionIcon.click();

  // Wait for popup to appear
  const enableCheckbox = await page.getByLabel('Enable filter');
  await expect(enableCheckbox).toBeVisible();

  // Interact with UI elements
  const prefixInput = page.locator('#prefix');
  await prefixInput.fill('test-prefix');

  const addBtn = page.locator('#addBtn');
  await addBtn.click();

  // Wait for the POST request to be recorded
  await page.waitForTimeout(500);

  expect(bucketRequests).toContain('POST:https://example.com/v1/bucket/test-prefix');

  // Click Bloom POST button
  const bloomBtn = page.locator('#bloomBtn');
  await bloomBtn.click();

  await page.waitForTimeout(500);

  expect(bucketRequests).toContain('POST:https://example.com/v1/bucket/test-prefix');
});