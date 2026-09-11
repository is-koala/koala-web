import { defineConfig } from "@playwright/test";

/**
 * İzole mesajlaşma e2e'si.
 *
 * Spec kendi backend'ini ve Next'ini ayağa kaldırır; paylaşılan
 * `webServer` burada yok. İkisi birden Pi'de bellekten düşüyordu
 * (`Error: aborted` / `Next dev exited early`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "messaging-safety.spec.ts",
  workers: 1,
  timeout: 120_000,
  use: {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
});
