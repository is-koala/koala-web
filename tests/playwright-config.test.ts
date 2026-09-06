import { describe, expect, it } from "vitest";

import config from "../playwright.config";

describe("Playwright test server isolation", () => {
  it("does not reuse an unrelated local server by default", () => {
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(config.use?.baseURL).toBe("http://localhost:3100");
    expect(webServer?.command).toContain("--port 3100");
    expect(webServer?.url).toBe("http://localhost:3100/api/health");
    expect(webServer?.reuseExistingServer).toBe(false);
  });
});
