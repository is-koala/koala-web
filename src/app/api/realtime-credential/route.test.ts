import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders as testRequestHeaders,
} from "../../../../tests/support/session-cookies";

import { POST } from "./route";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

describe("POST /api/realtime-credential", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "main-access-token");
    cookieStore.values.set("koala_rt", "main-refresh-token");
    testRequestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("oturum çerezini backend çağrısında kullanıp yalnız kısa ömürlü kimliği döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          token: "scoped-stomp-token",
          expiresAt: "2026-09-06T13:01:30Z",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const payload = await response.json();
    expect(payload).toEqual({
      token: "scoped-stomp-token",
      expiresAt: "2026-09-06T13:01:30Z",
      webSocketUrl: "wss://api.example.test/ws",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/realtime-credential");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer main-access-token");
    expect(JSON.stringify(payload)).not.toContain("main-access-token");
  });

  it("backend hatasını veya kimlikleri yansıtmadan REST fallback durumuna düşer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(429, {
          success: false,
          errorCode: "TOO_MANY_REQUESTS",
          message: "scoped-stomp-token",
        }),
      ),
    );

    const response = await POST();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body).toBe('{"error":"realtime_unavailable"}');
    expect(body).not.toContain("scoped-stomp-token");
    expect(body).not.toContain("main-access-token");
  });
});
