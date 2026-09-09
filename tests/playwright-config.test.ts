import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright test server isolation", () => {
  it("does not reuse an unrelated local server by default", async () => {
    const config = await loadConfig();
    const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
    const appServer = webServers.find((server) => server?.command.includes("npm run dev"));

    expect(config.use?.baseURL).toBe("http://localhost:3100");
    expect(appServer?.command).toContain("--port 3100");
    expect(appServer?.url).toBe("http://localhost:3100/api/health");
    expect(appServer?.reuseExistingServer).toBe(false);
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
});

async function loadConfig() {
  vi.stubEnv("PLAYWRIGHT_PORT", "3100");
  vi.stubEnv("PLAYWRIGHT_BACKEND_PORT", "4100");
  vi.resetModules();
  return (await import("../playwright.config")).default;
}
