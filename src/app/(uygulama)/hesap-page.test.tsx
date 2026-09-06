import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { AccountPage } from "./hesap-page";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
}));

describe("hesap sayfası bildirim sayfalaması", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.set("x-koala-path", "/panel/hesap");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("URL'deki ikinci bildirim sayfasını backend'in sıfır tabanlı sayfasından yükler", async () => {
    const feed = {
      notifications: {
        content: [], page: 1, size: 20, totalElements: 21, totalPages: 2, first: false, last: true,
      },
      unreadCount: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          envelope({
            id: "38a790b9-5212-438b-a3cd-1305b5b35ebf",
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.test",
            phoneNumber: "+905551112233",
            emailVerified: true,
            phoneVerified: true,
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope(feed)))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await AccountPage({ searchParams: Promise.resolve({ bildirimSayfasi: "2" }) });

    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
      "https://api.example.test/users/me/notifications?page=1",
    );
  });
});
