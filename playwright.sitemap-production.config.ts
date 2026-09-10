import { defineConfig } from "@playwright/test";

const appPort = process.env.SITEMAP_PLAYWRIGHT_PORT ?? "3410";
const apiPort = process.env.SITEMAP_PLAYWRIGHT_API_PORT ?? "3630";
const appURL = `http://127.0.0.1:${appPort}`;
const apiURL = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "sitemap-production.spec.ts",
  workers: 1,
  timeout: 120_000,
  use: { baseURL: appURL },
  webServer: [
    {
      command: "node tests/support/sitemap-api-server.mjs",
      env: { SITEMAP_PLAYWRIGHT_API_PORT: apiPort },
      url: `${apiURL}/health`,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && node .next/standalone/server.js",
      env: {
        API_URL: apiURL,
        APP_VERSION: "0.1.0",
        HOSTNAME: "127.0.0.1",
        PORT: appPort,
        NEXT_PUBLIC_SITE_URL: "https://iskoala.com",
        NEXT_PUBLIC_APP_URL_SCHEME: "koala",
      },
      url: `${appURL}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
