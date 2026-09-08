import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Self-hosted runner'ların üçü de aynı 4 çekirdekli Raspberry Pi'de
    // (is-koala/koala-backend#91). Her Vitest süreci çekirdek sayısı kadar worker
    // açarsa testler zaman sınırına çarpıyor. Playwright'ın aynı kısıtı
    // playwright.config.ts:11'de; ikisi de burada dursun ki yerel koşu ile CI
    // aynı komutu kullansın — kapı komutu AGENTS.md'de sabitlenmiş durumda.
    maxWorkers: process.env.CI ? 1 : undefined,
    testTimeout: process.env.CI ? 15_000 : 5_000,
  },
});
