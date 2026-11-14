import { test, expect, mockYouTube, enableFilter } from './fixtures.js';

// Loading an unpacked extension needs the full Chromium binary, which some
// sandboxes forbid (it dies in ProcessSingleton: "socket() failed"). The stub
// suite in content.browser.spec.ts covers the same content script without the
// extension runtime and runs everywhere, including here.
test.skip(process.env.SLOP_E2E_FULL !== '1', 'set SLOP_E2E_FULL=1 to run against a loaded extension');

// Exercises the real content script end to end: route a fake youtube.com, feed
// it a webm with a steady tone and hard cuts, let the actual feature extraction
// + scoring run, and assert what the overlay reports.
//
// The overlay lives in a closed shadow root, so the assertions read the host's
// data-verdict / data-kind attributes (set by showOverlay/showNotice).

const WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test('advisory overlay appears on a watch page when the filter is enabled', async ({ page, context }) => {
  await mockYouTube(context);
  await enableFilter(context);
  await page.goto(WATCH);

  const host = page.locator('#slop-filter-overlay');
  await expect(host).toHaveAttribute('data-kind', 'advisory', { timeout: 25000 });
  await expect(host).toHaveAttribute('data-verdict', /BLOCK|REVIEW/);
});

test('no overlay when the filter is disabled', async ({ page, context }) => {
  await mockYouTube(context);
  await page.goto(WATCH);
  await page.waitForTimeout(9000);
  await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
});

test('a muted video cannot reach BLOCK because the audio signal is missing', async ({ page, context }) => {
  await mockYouTube(context);
  await enableFilter(context);
  await page.goto(`${WATCH}&muted=1`);

  // No audio features -> S undefined -> MISSING_MODALITY_POLICY 'suspend' -> REVIEW.
  await expect(page.locator('#slop-filter-overlay')).toHaveAttribute('data-verdict', 'REVIEW', {
    timeout: 25000,
  });
});

test('no analysis while a pre-roll ad is playing', async ({ page, context }) => {
  await mockYouTube(context);
  await enableFilter(context);
  await page.goto(`${WATCH}&ad=1`);
  await page.waitForTimeout(9000);
  await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
});

test('a page with no video element stays silent', async ({ page, context }) => {
  await mockYouTube(context);
  await enableFilter(context);
  await page.goto(`${WATCH}&novideo=1`);
  await page.waitForTimeout(9000);
  await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
});

test('shorts pages are analyzed too', async ({ page, context }) => {
  await mockYouTube(context);
  await enableFilter(context);
  await page.goto('https://www.youtube.com/shorts/dQw4w9WgXcQ');

  await expect(page.locator('#slop-filter-overlay')).toHaveAttribute('data-kind', 'advisory', {
    timeout: 25000,
  });
});

test('enabling mid-session analyzes the current page without navigating', async ({ page, context }) => {
  await mockYouTube(context);
  await page.goto(WATCH);
  await page.waitForTimeout(2000);
  await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);

  await enableFilter(context);
  await expect(page.locator('#slop-filter-overlay')).toHaveAttribute('data-kind', 'advisory', {
    timeout: 25000,
  });
});