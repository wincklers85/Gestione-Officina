const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 7000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.GO_TEST_CHROMIUM_PATH ? {
      executablePath: process.env.GO_TEST_CHROMIUM_PATH,
      args: JSON.parse(process.env.GO_TEST_CHROMIUM_ARGS || '[]')
    } : {}
  }
});
