import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { unsubscribeRoute } from "./unsubscribe";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const token = "gizli-abonelik-tokeni_0123456789";

function unsubscribeRequest(body: unknown): Request {
  return new Request("https://iskoala.com/api/notification-preferences/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function backendRejects(status: number, errorCode: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse(status, {
        success: false,
        errorCode,
        errorCategory: "VALIDATION_FAILED",
        message: "ham backend mesajı",
      }),
    ),
  );
}

async function readOutcome(response: Response) {
  const text = await response.text();
  return { status: response.status, text, body: JSON.parse(text) as unknown };
}

describe("abonelikten çıkma BFF ucu", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("tokenı oturumsuz POST gövdesinde backend'e taşır ve kapatılan kanalı döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({ category: "MARKETINGS", channel: "EMAIL", alreadyDisabled: false }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await unsubscribeRoute(unsubscribeRequest({ token }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("https://api.example.test/notification-preferences/unsubscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token });
    // Uç giriş istemiyor (`SecurityConfig` permitAll); oturum çerezi olsa bile
    // tokenın sahibi bağlantının kendisi.
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-Device-Id")).toBe(deviceId);

    expect(await readOutcome(response)).toMatchObject({
      status: 200,
      body: { outcome: "unsubscribed", category: "MARKETINGS", channel: "EMAIL", alreadyDisabled: false },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("aynı bağlantıya ikinci tıkı hata değil, zaten kapalı bir başarı olarak döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope({ category: "NEWSLETTER", channel: "EMAIL", alreadyDisabled: true }),
        ),
      ),
    );

    expect(await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })))).toMatchObject({
      status: 200,
      body: { outcome: "unsubscribed", alreadyDisabled: true },
    });
  });

  it("süresi dolmuş ve geçersiz bağlantıyı ayrı sonuçlarla döndürür", async () => {
    backendRejects(400, "NOTIFICATION_UNSUBSCRIBE_TOKEN_EXPIRED");
    expect(await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })))).toMatchObject({
      status: 400,
      body: { outcome: "expired" },
    });

    backendRejects(400, "NOTIFICATION_UNSUBSCRIBE_TOKEN_INVALID");
    expect(await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })))).toMatchObject({
      status: 400,
      body: { outcome: "invalid" },
    });
  });

  it("backend arızasını kodla taşır, ham mesajı taşımaz", async () => {
    backendRejects(503, "UNEXPECTED");

    const outcome = await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })));

    expect(outcome).toMatchObject({
      status: 503,
      body: { outcome: "failed", errorCode: "UNEXPECTED", httpStatus: 503 },
    });
    expect(outcome.text).not.toContain("ham backend mesajı");
  });

  it("tokensız ya da bozuk gövdeyi backend'e sormadan geçersiz sayar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const body of [{}, { token: "" }, { token: 42 }, "{bozuk", { token: "a".repeat(2049) }]) {
      expect(await readOutcome(await unsubscribeRoute(unsubscribeRequest(body)))).toMatchObject({
        status: 400,
        body: { outcome: "invalid" },
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tokenı ne yanıta ne de sunucu loglarına yazar", async () => {
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, envelope({ category: "MARKETINGS", channel: "EMAIL", alreadyDisabled: false })),
      ),
    );
    const success = await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })));
    backendRejects(400, "NOTIFICATION_UNSUBSCRIBE_TOKEN_EXPIRED");
    const expired = await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError(`fetch failed for ${token}`)));
    const crashed = await readOutcome(await unsubscribeRoute(unsubscribeRequest({ token })));

    expect(crashed.body).toMatchObject({ outcome: "failed", errorCode: "UNEXPECTED" });
    for (const outcome of [success, expired, crashed]) {
      expect(outcome.text).not.toContain(token);
    }
    for (const log of logs) {
      expect(log).not.toHaveBeenCalled();
    }
  });
});
