import { defineConfig } from "@playwright/test"

export default defineConfig({
  globalSetup: "./.playwright-tests/global-setup.ts",
  testDir: ".playwright-tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
