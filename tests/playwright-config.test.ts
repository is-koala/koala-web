import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// `defineConfig` kimlik fonksiyonu: asıl paket tam Vitest süitinde 5 sn
// zaman sınırını aşıyor. İzolasyon iddiaları yine gerçek config dosyasını
// değerlendirir; reuseExistingServer ve iki webServer tanımı değişmez.
vi.mock("@playwright/test", () => ({
  defineConfig: <T>(config: T) => config,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright test server isolation", () => {
  it("does not reuse an unrelated local server by default", async () => {
    const config = await loadConfig();
    const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
    const appServer = webServers.find((server) => server?.command.includes("npm run dev"));
    const backendServer = webServers.find((server) =>
      server?.command.includes("tests/support/e2e-backend.mjs"),
    );

    expect(config.use?.baseURL).toBe("http://localhost:3100");
    expect(appServer?.command).toContain("--port 3100");
    expect(appServer?.url).toBe("http://localhost:3100/api/health");
    expect(appServer?.env).toMatchObject({
      NEXT_PUBLIC_SITE_URL: "https://iskoala.com",
      NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY: "",
    });
    expect(backendServer?.url).toBe("http://127.0.0.1:4100/__test__/health");
    for (const server of webServers) expect(server?.reuseExistingServer).toBe(false);
  });

  it("CI API_URL değerini miras almak yerine hermetik E2E backend'ini zorlar", async () => {
    vi.stubEnv("API_URL", "https://staging-api.example.test");
    const config = await loadConfig();
    const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
    const appServer = webServers.find((server) => server?.command.includes("npm run dev"));

    expect(appServer).toMatchObject({
      env: { API_URL: "http://127.0.0.1:4100" },
    });
  });

  it("runs the production sitemap regression from the mandatory e2e script", () => {
    const packageMetadata = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageMetadata.scripts?.["test:e2e"]).toContain(
      "npm run test:e2e:sitemap-production",
    );
  });
});

async function loadConfig() {
  vi.stubEnv("PLAYWRIGHT_PORT", "3100");
  vi.stubEnv("PLAYWRIGHT_BACKEND_PORT", "4100");
  vi.resetModules();
  vi.doMock("@playwright/test", () => ({
    defineConfig: <T>(config: T) => config,
  }));
  return (await import("../playwright.config")).default;
}
