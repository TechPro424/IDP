import { test, expect } from '@playwright/test';

test('extension loads and opens popup', async ({ page }) => {
  // Navigate to a dummy page
  await page.goto('https://www.example.com');
  // The extension icon should be present in the toolbar
  const extensionIcon = await page.getByLabel('Slop Filter');
  await expect(extensionIcon).toBeVisible();
  // Click the icon to open the popup
  await extensionIcon.click();
  // Popup should contain the enable checkbox
  const enableCheckbox = await page.getByLabel('Enable filter');
  await expect(enableCheckbox).toBeVisible();
});