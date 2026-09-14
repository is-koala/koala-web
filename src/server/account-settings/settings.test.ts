import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";
import { redirectTo } from "../../../tests/support/navigation";

import {
  addBankAccount,
  deleteBankAccount,
  getAccountDeletion,
  loadAccountDeletionStatus,
  loadAccountSettings,
  listBankAccounts,
  listNotifications,
  requestAccountDeletion,
  selectPrimaryBankAccount,
  startBankAccountVerification,
} from "./settings";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const rawIban = "TR330006100519786457841326";
const deletionStatusRequestId = "8847a941-da0e-45f3-868e-b262896243e4";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
  unstable_rethrow: (error: unknown) => {
    if (String((error as { message?: unknown })?.message).startsWith("REDIRECT:")) throw error;
  },
}));

describe("hesap ayarları banka sözleşmesi", () => {
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

  it("IBAN doğrulamasını başlatır ve BigDecimal tutarı iki ondalıklı dize olarak taşır", async () => {
    const accountId = "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          accountId,
          maskedIban: "TR33 **** **** **** **** **13 26",
          status: "PENDING",
          reference: "KOALA-7Q2M",
          amount: 1.3,
          targetIban: "TR900006200000000000000001",
          expiresAt: "2026-09-20T12:00:00Z",
          attemptsLeft: 2,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(startBankAccountVerification(accountId)).resolves.toEqual({
      accountId,
      maskedIban: "TR33 **** **** **** **** **13 26",
      status: "PENDING",
      reference: "KOALA-7Q2M",
      amount: "1.30",
      currency: "TRY",
      targetIban: "TR900006200000000000000001",
      expiresAt: "2026-09-20T12:00:00Z",
      attemptsLeft: 2,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/users/me/bank-accounts/${accountId}/verification`,
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("referanssız doğrulama yanıtını talimat gibi göstermez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(
      startBankAccountVerification("b4bca2a3-ced9-4fc5-8434-6e5a45c26e80"),
    ).rejects.toMatchObject({ errorCode: "UNEXPECTED" });
  });

  it("hesap silme talebinin güncel durumunu auth'lu ve no-store olarak okur", async () => {
    const deletion = {
      id: "1b1ad05a-e5a7-4b78-893e-ac0901818671",
      subjectId: "38a790b9-5212-438b-a3cd-1305b5b35ebf",
      status: "REQUESTED",
      requestedAt: "2026-09-09T09:30:00Z",
      processedAt: null,
      blockedReason: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(deletion)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAccountDeletion();
    expect(result).toEqual({
      status: "REQUESTED",
      requestedAt: "2026-09-09T09:30:00Z",
      processedAt: null,
      blockedReason: null,
    });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("subjectId");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/legal/account-deletion");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-placeholder");
  });

  it("hesap silme gerekçesini yalnız POST gövdesinde taşır", async () => {
    const reason = "Artık kullanmıyorum";
    const deletion = {
      id: "1b1ad05a-e5a7-4b78-893e-ac0901818671",
      subjectId: "38a790b9-5212-438b-a3cd-1305b5b35ebf",
      status: "REQUESTED",
      requestedAt: "2026-09-09T09:30:00Z",
      processedAt: null,
      blockedReason: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(deletion)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestAccountDeletion(reason)).resolves.toEqual({
      status: "REQUESTED",
      requestedAt: "2026-09-09T09:30:00Z",
      processedAt: null,
      blockedReason: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/legal/account-deletion");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ reason });
  });

  it("yalnız kanonik bulunamadı kodunu henüz talep yok durumuna çevirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(404, {
          success: false,
          errorCode: "LEGAL_DELETION_NOT_FOUND",
          errorCategory: "RESOURCE_NOT_FOUND",
          message: "Ham backend metni",
          requestId: "request-none",
        }),
      ),
    );

    await expect(loadAccountDeletionStatus()).resolves.toEqual({ kind: "not-requested" });
  });

  it("durum okuma hatasında ham mesajı değil kodu ve destek kimliğini taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          errorCode: "UPSTREAM_UNAVAILABLE",
          errorCategory: "UPSTREAM_FAILED",
          message: "İç sistem ayrıntısı ve kişisel veri",
          requestId: deletionStatusRequestId,
        }),
      ),
    );

    const result = await loadAccountDeletionStatus();

    expect(result).toEqual({
      kind: "error",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
      requestId: deletionStatusRequestId,
    });
    expect(JSON.stringify(result)).not.toContain("kişisel veri");
  });

  it("destek kimliği güvenli biçimde değilse istemci durumuna taşımaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          errorCode: "UPSTREAM_UNAVAILABLE",
          errorCategory: "UPSTREAM_FAILED",
          message: "İç sistem metni",
          requestId: "kullanici@example.test access-token",
        }),
      ),
    );

    await expect(loadAccountDeletionStatus()).resolves.toEqual({
      kind: "error",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
      requestId: null,
    });
  });

  it("anonimleştirme oturumu kapattıysa durum hatasına çevirmeden çerezleri temizleyip girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse(401, {
          success: false,
          errorCode: "AUTH_SESSION_NOT_FOUND_OR_INACTIVE",
          errorCategory: "AUTHENTICATION_REQUIRED",
          message: "Oturum kapandı",
        }),
      ),
    );

    await expect(loadAccountDeletionStatus()).rejects.toThrow(
      redirectTo("/giris?next=%2Fpanel%2Fhesap"),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("hesap merkezinin beş veri kaynağını mevcut BFF oturumuyla birlikte okur", async () => {
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
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          envelope([
            {
              id: "4ace3ee5-f9fd-420c-8926-b35f2b82915a",
              deviceId: "30c46a8e-3e1b-4c35-b616-550171243a8b",
              deviceType: "WEB",
              deviceName: "Safari",
              ipAddress: "192.0.2.1",
              location: "İstanbul",
              lastAccessedAt: "2026-09-06T12:00:00Z",
              refreshExpiresAt: "2026-10-06T12:00:00Z",
              current: true,
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(404, {
          success: false,
          errorCode: "LEGAL_DELETION_NOT_FOUND",
          errorCategory: "RESOURCE_NOT_FOUND",
          message: "Talep yok",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAccountSettings(1)).resolves.toEqual({
      bankAccounts: [],
      notifications: feed,
      preferences: [],
      sessions: [
        {
          id: "4ace3ee5-f9fd-420c-8926-b35f2b82915a",
          deviceType: "WEB",
          deviceName: "Safari",
          location: "İstanbul",
          lastAccessedAt: "2026-09-06T12:00:00Z",
          current: true,
        },
      ],
      accountDeletion: { kind: "not-requested" },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me/bank-accounts",
      "https://api.example.test/users/me/notifications?page=1",
      "https://api.example.test/users/me/notification-preferences",
      "https://api.example.test/users/me/sessions",
      "https://api.example.test/legal/account-deletion",
    ]);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-placeholder");
      expect(new Headers(init.headers).get("X-Device-Id")).toBe(deviceId);
    }
  });

  it("eski bildirimler için istenen backend sayfasını okur", async () => {
    const secondPage = {
      notifications: {
        content: [], page: 1, size: 20, totalElements: 21, totalPages: 2, first: false, last: true,
      },
      unreadCount: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(secondPage)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotifications(1)).resolves.toEqual(secondPage);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/users/me/notifications?page=1",
    );
  });
});
