// Content-script tests that need no extension host.
//
// The extension-loading suite (content.spec.ts) needs a Chromium that can load
// unpacked extensions, which not every environment allows. This suite runs the
// *built* content script in a plain page instead: the mock youtube.com page is
// routed, `chrome.*` is stubbed in the page, and dist/content.js is injected
// with addScriptTag. Same real pipeline — real WebAudio, real canvas, real
// feature extraction — without the extension runtime.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockYouTube } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_JS = path.resolve(__dirname, '../dist/content.js');
const WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

interface StubOptions {
  enabled?: boolean;
  verdict?: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

/**
 * A minimal chrome.* surface: promise- and callback-style storage (the content
 * script uses both), a message channel that answers scoreVideo with a fixed
 * verdict and records what it received, and no lastError.
 */
function chromeStub(options: StubOptions): string {
  const store = {
    enabled: options.enabled ?? true,
    consent: true,
    edgeOrigin: '',
    tauS: 0.6,
    tauH: 0.6,
    grayBand: 0.1,
    missingModalityPolicy: 'suspend',
    annotation: false,
    annotationConsent: false,
    allowlist: [] as string[],
    denylist: [] as string[],
    reduceMotion: false,
  };
  const verdict = options.verdict ?? 'REVIEW';
  return `(() => {
    const store = ${JSON.stringify(store)};
    window.__sent = [];
    const listeners = [];
    const local = {
      get: (keys, cb) => {
        const out = keys == null ? { ...store }
          : Array.isArray(keys) ? Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]))
          : Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in store ? store[k] : d]));
        if (cb) { cb(out); return; }
        return Promise.resolve(out);
      },
      set: (patch, cb) => {
        const changes = {};
        for (const [k, v] of Object.entries(patch)) { changes[k] = { oldValue: store[k], newValue: v }; store[k] = v; }
        for (const l of listeners) l(changes, 'local');
        if (cb) { cb(); return; }
        return Promise.resolve();
      },
      clear: (cb) => { for (const k of Object.keys(store)) delete store[k]; if (cb) cb(); return Promise.resolve(); },
    };
    window.chrome = {
      runtime: {
        lastError: undefined,
        id: 'stub',
        sendMessage: (message, cb) => {
          window.__sent.push(message);
          const reply = message && message.type === 'scoreVideo'
            ? { verdict: '${verdict}', SRS: 0.72, reasons: ['Synthetic narration'] }
            : { ok: true };
          if (cb) { cb(reply); return; }
          return Promise.resolve(reply);
        },
        onMessage: { addListener: () => {} },
      },
      storage: { local, sync: local, onChanged: { addListener: (fn) => listeners.push(fn) } },
      permissions: { request: async () => true, contains: async () => true },
    };
  })();`;
}

/** Stub chrome.*, open a mock page, then inject the built content script. */
async function loadContentScript(page: Page, options: StubOptions = {}, url = WATCH): Promise<void> {
  await page.addInitScript(chromeStub(options));
  await page.goto(url);
  await page.addScriptTag({ content: fs.readFileSync(CONTENT_JS, 'utf8') });
}

// The fixture page autoplays an unmuted tone, which headless Chromium blocks
// without this flag - and without audio there is nothing for the pipeline to
// analyse, so the tests below would pass while proving nothing.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test.describe('content script in a plain page', () => {
  test('runs the full pipeline and shows the advisory card', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page);

    const host = page.locator('#slop-filter-overlay');
    await expect(host).toHaveAttribute('data-kind', 'advisory', { timeout: 45000 });
    await expect(host).toHaveAttribute('data-verdict', 'REVIEW');

    // features really crossed the message channel
    const scored = await page.evaluate(
      () => (window as any).__sent.filter((m: any) => m.type === 'scoreVideo'),
    );
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0].videoId).toBe('dQw4w9WgXcQ');

    // The audio path is the one with real DSP in it; asserting "something was
    // sent" would also pass on the captions alone (the page has ~230 chars).
    const audio = scored[0].features?.audio;
    expect(audio, 'no audio features - the fixture video did not play').toBeTruthy();
    expect(audio.voicedRatio).toBeGreaterThan(0);
    expect(Number.isFinite(audio.flatnessVariance)).toBe(true);
    expect(audio.missing).toBe(false);
  });

  test('an ALLOW verdict leaves no overlay', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page, { verdict: 'ALLOW' });
    await page.waitForFunction(() => (window as any).__sent.some((m: any) => m.type === 'scoreVideo'), null, {
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
  });

  test('stays silent when the filter is disabled', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page, { enabled: false });
    await page.waitForTimeout(9000);
    await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__sent.length)).toBe(0);
  });

  test('no analysis while a pre-roll ad is playing', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page, {}, `${WATCH}&ad=1`);
    await page.waitForTimeout(9000);
    await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__sent.length)).toBe(0);
  });

  test('a page with no video element stays silent', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page, {}, `${WATCH}&novideo=1`);
    await page.waitForTimeout(9000);
    await expect(page.locator('#slop-filter-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__sent.length)).toBe(0);
  });

  test('analysis does not block the main thread', async ({ page, context }) => {
    await mockYouTube(context);
    await page.addInitScript(() => {
      (window as any).__longtasks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) (window as any).__longtasks.push(Math.round(e.duration));
      }).observe({ entryTypes: ['longtask'] });
    });
    // reset after load so only the analysis window is measured
    await loadContentScript(page, {}, WATCH).then(() => {});
    await page.evaluate(() => { (window as any).__longtasks = []; });
    await page.evaluate(() => (window as any).chrome.storage.local.set({ enabled: true }));
    await expect(page.locator('#slop-filter-overlay')).toHaveAttribute('data-kind', 'advisory', {
      timeout: 45000,
    });
    // Budget (plan Phase 6, docs/manual-smoke.md §8): the 6 s capture must not
    // block the main thread. The feature loop yields every 16 frames, so no task
    // may run long; one ~85 ms task per analysis is allowed because it is not
    // ours - a CPU profile over the whole window shows ~100 ms of total JS self
    // time, and it still appears when the caller passes an ALLOW verdict, so
    // there is no overlay work in it. A *pattern* of long tasks is the failure
    // this test is looking for.
    const longTasks: number[] = await page.evaluate(() => (window as any).__longtasks);
    expect(longTasks.filter((d) => d >= 150), `long tasks: ${JSON.stringify(longTasks)}`).toEqual([]);
    expect(longTasks.length, `long tasks: ${JSON.stringify(longTasks)}`).toBeLessThanOrEqual(1);
  });

  test('shorts pages are analysed too', async ({ page, context }) => {
    await mockYouTube(context);
    await loadContentScript(page, {}, 'https://www.youtube.com/shorts/dQw4w9WgXcQ');
    await expect(page.locator('#slop-filter-overlay')).toHaveAttribute('data-kind', 'advisory', {
      timeout: 45000,
    });
  });

});
