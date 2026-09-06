import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import {
  addBankAccount,
  deleteBankAccount,
  loadAccountSettings,
  listBankAccounts,
  selectPrimaryBankAccount,
} from "./settings";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const rawIban = "TR330006100519786457841326";

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

describe("hesap ayarları banka sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hesapları yalnız backend'in maskeli gösterim DTO'suyla listeler", async () => {
    const accounts = [
      {
        id: "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80",
        maskedIban: "TR33 **** **** **** **** **13 26",
        primary: true,
        verificationStatus: "PENDING",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(accounts)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listBankAccounts();
    expect(result).toEqual(accounts);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/users/me/bank-accounts",
    );
    expect(JSON.stringify(result)).not.toContain(rawIban);
  });

  it("IBAN'ı yalnız ekleme isteğinin gövdesinde taşır ve maskeli yanıtı döndürür", async () => {
    const account = {
      id: "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80",
      maskedIban: "TR33 **** **** **** **** **13 26",
      primary: true,
      verificationStatus: "PENDING",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope(account)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(addBankAccount(rawIban)).resolves.toEqual(account);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/bank-accounts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ iban: rawIban });
    expect(JSON.stringify(account)).not.toContain(rawIban);
  });

  it("birincil seçimi ve silmeyi sahiplik güvenli kaynak yoluna yollar", async () => {
    const accountId = "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80";
    const account = {
      id: accountId,
      maskedIban: "TR33 **** **** **** **** **13 26",
      primary: true,
      verificationStatus: "VERIFIED",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(account)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(selectPrimaryBankAccount(accountId)).resolves.toEqual(account);
    await expect(deleteBankAccount(accountId)).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.test/users/me/bank-accounts/${accountId}/primary`,
      `https://api.example.test/users/me/bank-accounts/${accountId}`,
    ]);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("hesap merkezinin dört veri kaynağını mevcut BFF oturumuyla birlikte okur", async () => {
    const feed = {
      notifications: {
        content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true,
      },
      unreadCount: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope(feed)))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAccountSettings()).resolves.toEqual({
      bankAccounts: [], notifications: feed, preferences: [], sessions: [],
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me/bank-accounts",
      "https://api.example.test/users/me/notifications",
      "https://api.example.test/users/me/notification-preferences",
      "https://api.example.test/users/me/sessions",
    ]);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-placeholder");
      expect(new Headers(init.headers).get("X-Device-Id")).toBe(deviceId);
    }
  });
});
