import { test, expect } from '@playwright/test';

// Placeholder test for future Bloom‑POST and audio capture flow
// Currently just verifies Playwright is working.

test('placeholder bloom and audio flow', async ({ page }) => {
  await page.goto('https://example.com');
  // In a real test we would interact with the extension and capture
  // responses from the background script. Here we simply check navigation.
  const title = await page.title();
  expect(title).toBe('Example Domain');
});
