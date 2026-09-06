import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /.well-known/apple-app-site-association", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("yapılandırıldığında yönlendirmesiz JSON döner", async () => {
    vi.stubEnv("APPLE_APP_IDENTIFIER", "PREFIX.com.iskoala.koala");

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toBeNull();
  });

  it("uygulama kimliği yoksa geçersiz belge yayımlamaz", () => {
    vi.stubEnv("APPLE_APP_IDENTIFIER", "");

    expect(GET().status).toBe(503);
  });

  it("Application Identifier Prefix ve bundle kimliği biçimini doğrular", () => {
    vi.stubEnv("APPLE_APP_IDENTIFIER", "com.iskoala.koala");

    expect(GET().status).toBe(503);
  });
});
