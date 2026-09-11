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
    vi.stubEnv("CI", "");
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
    vi.stubEnv("CI", "");
    vi.stubEnv("API_URL", "https://staging-api.example.test");
    const config = await loadConfig();
    const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
    const appServer = webServers.find((server) =>
      server?.command.includes("npm run dev") || server?.command.includes("next start"),
    );

    expect(appServer).toMatchObject({
      env: { API_URL: "http://127.0.0.1:4100" },
    });
  });

  it("CI'da Turbopack yerine üretim sunucusunu ayağa kaldırır", async () => {
    vi.stubEnv("CI", "1");
    const config = await loadConfig();
    const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
    const appServer = webServers.find((server) =>
      server?.command.includes("e2e-web-ci.sh"),
    );

    expect(appServer?.command).toContain("tests/support/e2e-web-ci.sh");
    expect(appServer?.command).not.toContain("next dev");
    expect(appServer?.env).toMatchObject({ HOSTNAME: "127.0.0.1", PORT: "3100" });
  });

  it("runs the production sitemap regression from the mandatory e2e script", () => {
    const packageMetadata = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageMetadata.scripts?.["test:e2e"]).toContain(
      "npm run test:e2e:sitemap-production",
    );
  });

  it("paylaşılan webServer kapanmadan ikinci Next derleyicisini ayağa kaldırmaz", async () => {
    vi.stubEnv("CI", "");
    const config = await loadConfig();
    const ignored = [config.testIgnore].flat().map((pattern) => String(pattern ?? ""));
    expect(ignored.some((pattern) => pattern.includes("messaging-safety"))).toBe(true);

    const isolated = await loadIsolatedMessagingConfig();
    expect(isolated.webServer).toBeUndefined();
    expect(String(isolated.testMatch)).toContain("messaging-safety");

    const script = e2eScript();
    const defaultSuite = script.indexOf("playwright test &&");
    const isolatedRun = script.indexOf("playwright.messaging-safety.config.ts");
    const sitemapRun = script.indexOf("test:e2e:sitemap-production");
    expect(isolatedRun).toBeGreaterThan(defaultSuite);
    expect(sitemapRun).toBeGreaterThan(isolatedRun);
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

async function loadIsolatedMessagingConfig() {
  vi.resetModules();
  vi.doMock("@playwright/test", () => ({
    defineConfig: <T>(config: T) => config,
  }));
  return (await import("../playwright.messaging-safety.config")).default;
}

function e2eScript() {
  const packageMetadata = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  return packageMetadata.scripts?.["test:e2e"] ?? "";
}
