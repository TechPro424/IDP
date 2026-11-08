import { defineConfig } from '@playwright/test';

// Browser-vs-Node parity. Separate from the ts-node suites in the root `test`
// script because it needs a Chromium install.
export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/global-setup.ts',
  retries: 0,
  timeout: 120000,
});
