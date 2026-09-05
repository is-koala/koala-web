import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    env: {
      API_URL: process.env.API_URL ?? "https://api.example.test",
      APP_VERSION: process.env.APP_VERSION ?? "0.1.0",
    },
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
  },
});
