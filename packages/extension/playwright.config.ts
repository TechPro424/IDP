import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 0,
  use: {
    headless: true,
    // Use Chrome with extension
    channel: 'chrome',
    // Path to the extension directory
    // This will be resolved relative to the project root
    // Playwright will launch a browser with the extension loaded
    // The extension will be loaded from the output of the build step
    // For simplicity, we load the source directory directly
    launchOptions: {
      args: [
        `--disable-extensions-except=${process.cwd()}/packages/extension`,
        `--load-extension=${process.cwd()}/packages/extension`
      ]
    }
  }
});