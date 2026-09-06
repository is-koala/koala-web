import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cookieStore, envelope, jsonResponse, requestHeaders } from "../../../tests/support/session-cookies";
import { redirectTo } from "../../../tests/support/navigation";

import {
  addBankAccountAction,
  confirmVerificationAction,
  deleteBankAccountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  selectPrimaryBankAccountAction,
  updateContactAction,
  updatePasswordAction,
} from "./hesap-actions";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const rawIban = "TR330006100519786457841326";
const accountId = "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80";
const notificationId = "d0bf18da-c745-4051-a417-b123e4b61016";
const sessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
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

describe("hesap ayarları action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.set("x-koala-path", "/panel/hesap");
    revalidatePath.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("oturumu action içinde yeniden doğrular", async () => {
    cookieStore.values.delete("koala_at");
    cookieStore.values.delete("koala_rt");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(addBankAccountAction({ status: "idle" }, fields({ iban: rawIban }))).rejects.toThrow(
      redirectTo("/giris?next=%2Fpanel%2Fhesap"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("boşluklu IBAN'ı normalize eder; başarılı sonuçta ham değeri taşımaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          201,
          envelope({
            id: accountId,
            maskedIban: "TR33 **** **** **** **** **13 26",
            primary: true,
            verificationStatus: "PENDING",
          }),
        ),
      ),
    );

    const state = await addBankAccountAction(
      { status: "idle" },
      fields({ iban: "TR33 0006 1005 1978 6457 8413 26" }),
    );

    expect(state).toEqual({ status: "done" });
    expect(JSON.stringify(state)).not.toContain(rawIban);
    expect(revalidatePath).toHaveBeenCalledWith("/panel/hesap");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/hesap");
  });

  it.each([
    "DE89370400440532013000",
    "TR3300061005",
    "TR001234567890123456789012",
  ])("geçersiz IBAN'ı backend'e göndermeden alan hatası verir: %s", async (submitted) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await addBankAccountAction({ status: "idle" }, fields({ iban: submitted }));

    expect(state).toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { iban: "Geçerli bir TR IBAN gir." },
    });
    expect(JSON.stringify(state)).not.toContain(submitted);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backend hata mesajı IBAN içerse bile tarayıcı state'ine yalnız kodu taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          errorCode: "VALIDATION_FAILED",
          errorCategory: "VALIDATION",
          message: `Geçersiz değer: ${rawIban}`,
          details: [{ field: "iban", message: `Geçersiz IBAN: ${rawIban}` }],
        }),
      ),
    );

    const state = await addBankAccountAction({ status: "idle" }, fields({ iban: rawIban }));

    expect(state).toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { iban: "Geçerli bir TR IBAN gir." },
    });
    expect(JSON.stringify(state)).not.toContain(rawIban);
  });

  it("iletişim alan hatasını formdaki value alanına eşler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          errorCode: "VALIDATION_FAILED",
          errorCategory: "VALIDATION",
          message: "Doğrulama başarısız",
          details: [{ field: "email", message: "Bu e-posta kullanılamıyor." }],
        }),
      ),
    );

    await expect(
      updateContactAction({ status: "idle" }, fields({ kind: "email", value: "yeni@example.test" })),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { value: "Bu e-posta kullanılamıyor." },
    });
  });

  it("birincil seçme ve silme action'larını doğru kaynak kimliğiyle yürütür", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: accountId })))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      selectPrimaryBankAccountAction({ status: "idle" }, fields({ accountId })),
    ).resolves.toEqual({ status: "done" });
    await expect(
      deleteBankAccountAction({ status: "idle" }, fields({ accountId })),
    ).resolves.toEqual({ status: "done" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.test/users/me/bank-accounts/${accountId}/primary`,
      `https://api.example.test/users/me/bank-accounts/${accountId}`,
    ]);
  });

  it("iletişim değişikliğinin doğrulama kimliğini koda kadar güvenle taşır", async () => {
    const verificationId = "f9601bf0-f398-481c-8c82-d3f84229c119";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          envelope({
            user: {},
            pendingVerifications: [
              { id: verificationId, type: "EMAIL", sentTo: "yeni@example.test", message: "Kod gönderildi" },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateContactAction({ status: "idle" }, fields({ kind: "email", value: "yeni@example.test" })),
    ).resolves.toEqual({
      status: "done",
      verification: { id: verificationId, type: "EMAIL", sentTo: "yeni@example.test" },
    });
    await expect(
      confirmVerificationAction(
        { status: "idle" },
        fields({ verificationId, token: "123456" }),
      ),
    ).resolves.toEqual({ status: "done" });

    expect(request(fetchMock, 0)).toMatchObject({ method: "PATCH", body: { email: "yeni@example.test" } });
    expect(request(fetchMock, 1)).toMatchObject({
      method: "POST",
      body: { token: "123456" },
      url: `https://api.example.test/verifications/${verificationId}/confirm`,
    });
  });

  it("parolayı backend alan adlarıyla günceller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updatePasswordAction(
        { status: "idle" },
        fields({
          currentPassword: "Eski2026",
          newPassword: "Yeni2026",
          confirmNewPassword: "Yeni2026",
        }),
      ),
    ).resolves.toEqual({ status: "done" });

    expect(request(fetchMock, 0)).toMatchObject({
      method: "PUT",
      body: {
        currentPassword: "Eski2026",
        newPassword: "Yeni2026",
        confirmNewPassword: "Yeni2026",
      },
      url: "https://api.example.test/users/me/password",
    });
  });

  it("bildirim, tercih ve oturum değişikliklerini mevcut uçlarla yapar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await markNotificationReadAction({ status: "idle" }, fields({ notificationId }));
    await markAllNotificationsReadAction({ status: "idle" }, new FormData());
    await revokeSessionAction({ status: "idle" }, fields({ sessionId }));
    await revokeOtherSessionsAction({ status: "idle" }, new FormData());

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.test/users/me/notifications/${notificationId}/read`,
      "https://api.example.test/users/me/notifications/read",
      `https://api.example.test/users/me/sessions/${sessionId}`,
      "https://api.example.test/users/me/sessions",
    ]);
  });

});

function fields(values: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return formData;
}

function request(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}
