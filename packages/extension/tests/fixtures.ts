import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, '../dist');
    const manifestPath = path.join(pathToExtension, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      const packageRoot = path.resolve(__dirname, '..');
      execSync('pnpm run build', { cwd: packageRoot, stdio: 'inherit' });
    }
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `Extension build not found at ${pathToExtension}. Please build the extension before running e2e tests.`
      );
    }
    // Chromium's ProcessSingleton opens an AF_UNIX socket, which some sandboxes
    // forbid ("process_singleton_posix.cc:297 socket() failed: Operation not
    // permitted"). --single-process --no-zygote avoids that path entirely.
    // $HOME must also be writable (crashpad), so keep the profile inside the
    // package rather than /tmp, which is not always writable either.
    const profileRoot = path.join(__dirname, '../.playwright');
    const home = path.join(profileRoot, 'home');
    mkdirSync(path.join(home, '.config'), { recursive: true });
    const context = await chromium.launchPersistentContext(path.join(profileRoot, 'profile'), {
      // chrome-headless-shell cannot load extensions; the full Chromium can.
      channel: 'chromium',
      headless: true,
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') },
      args: [
        // the fixture page autoplays a tone; headless has no user gesture
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--disable-breakpad',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 }).catch((err) => {
        throw new Error(
          `Timed out waiting for extension service worker. Ensure the extension built properly in dist. Original error: ${err.message}`
        );
      });
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;

/**
 * Serve a fake www.youtube.com so the content script can be exercised without
 * touching the network. Watch/Shorts URLs get the mock page; /test-media/* gets
 * a real (tone + hard cuts) webm so the analyser and the frame sampler have
 * something to measure.
 */
export async function mockYouTube(context: BrowserContext): Promise<void> {
  const html = fs.readFileSync(path.resolve(__dirname, 'fixtures/pages/watch.html'));
  const media = fs.readFileSync(path.resolve(__dirname, 'fixtures/media/tone-cuts.webm'));
  await context.route('https://www.youtube.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/test-media/')) {
      return route.fulfill({ status: 200, contentType: 'video/webm', body: media });
    }
    if (url.pathname === '/watch' || url.pathname.startsWith('/shorts/')) {
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

/** Flip the persisted settings the way the options page would. */
export async function enableFilter(context: BrowserContext, patch: Record<string, unknown> = {}): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (extra) => {
      const current = await chrome.storage.local.get(null);
      await chrome.storage.local.set({ ...current, enabled: true, consent: true, ...extra });
    },
    patch,
  );
}
