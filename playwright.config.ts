import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Self-hosted runner'ların üçü de aynı 4 çekirdekli Raspberry Pi'de.
  // CI'da tek browser worker kullanarak makine genelinde aşırı paralelliği önle.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      API_URL: process.env.API_URL ?? "https://api.example.test",
      APP_VERSION: process.env.APP_VERSION ?? "0.1.0",
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
  },
});
