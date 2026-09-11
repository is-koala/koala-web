import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${port}`;
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT ?? String(Number(port) + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  /*
   * Bu dosya kendi Next'ini spawn ediyor. Paylaşılan `webServer` hâlâ
   * ayaktayken ikinci Turbopack Pi'de bellekten düşüyor (`Error: aborted`,
   * `Next dev exited early`). Ayrı süreç, paylaşılan sunucu kapandıktan sonra
   * `playwright.messaging-safety.config.ts` ile koşar.
   */
  testIgnore: /messaging-safety\.spec\.ts/,
  fullyParallel: true,
  // Self-hosted runner'ların üçü de aynı 4 çekirdekli Raspberry Pi'de.
  // CI'da tek browser worker kullanarak makine genelinde aşırı paralelliği önle.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
  webServer: [
    {
      command: `node tests/support/e2e-backend.mjs ${backendPort}`,
      url: `${backendURL}/__test__/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
      env: {
        // E2E hiçbir koşulda CI/staging API'sine çıkmaz; testler yalnız aşağıdaki
        // süreçte başlatılan hermetik fixture ile konuşur.
        API_URL: backendURL,
        APP_VERSION: process.env.APP_VERSION ?? "0.1.0",
        NEXT_PUBLIC_SITE_URL: "https://iskoala.com",
        NEXT_PUBLIC_APP_URL_SCHEME: process.env.NEXT_PUBLIC_APP_URL_SCHEME ?? "koala-dev",
        // CI'daki Maps anahtarı bu sürece sızmasın: boş anahtar betik indirmez
        // ve klavye yolu formun varsayılanıdır (is-koala/koala-web#133).
        NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY: "",
      },
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
    },
  ],
});
