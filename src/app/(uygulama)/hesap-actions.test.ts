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
  requestAccountDeletionAction,
  selectPrimaryBankAccountAction,
  startBankAccountVerificationAction,
  updateContactAction,
  updatePasswordAction,
} from "./hesap-actions";
import { listNotifications } from "@/server/account-settings/settings";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const rawIban = "TR330006100519786457841326";
const accountId = "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80";
const notificationId = "d0bf18da-c745-4051-a417-b123e4b61016";
const sessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";
const deletionRequestId = "c563451e-eb1a-4cf1-a521-246abae16a57";
const duplicateRequestId = "993e6b6d-a7ec-4a58-82e0-2f3a1fd21ef9";

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
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) throw error;
  },
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

  it("hesap silme action'ı doğrudan çağrıldığında da oturum kapısını aşamaz", async () => {
    cookieStore.values.delete("koala_at");
    cookieStore.values.delete("koala_rt");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestAccountDeletionAction(
        { status: "idle" },
        fields({
          confirmation: "account-deletion-irrevocable",
          reason: "Artık kullanmıyorum",
        }),
      ),
    ).rejects.toThrow(redirectTo("/giris?next=%2Fpanel%2Fhesap"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hesap silme talebini açık ve sunucuda doğrulanan onay olmadan göndermez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestAccountDeletionAction(
        { status: "idle" },
        fields({ reason: "Artık kullanmıyorum" }),
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { confirmation: "Geri alınamaz etkiyi onaylamalısın." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("onaylı hesabı silme talebini gerekçeyle oluşturur ve oturumu bekleme süresince açık tutar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          id: "1b1ad05a-e5a7-4b78-893e-ac0901818671",
          subjectId: "38a790b9-5212-438b-a3cd-1305b5b35ebf",
          status: "REQUESTED",
          requestedAt: "2026-09-09T09:30:00Z",
          processedAt: null,
          blockedReason: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAccountDeletionAction(
      { status: "idle" },
      fields({
        confirmation: "account-deletion-irrevocable",
        reason: "  Artık kullanmıyorum  ",
      }),
    );

    expect(result).toEqual({
      status: "done",
      outcome: "created",
      deletion: {
        status: "REQUESTED",
        requestedAt: "2026-09-09T09:30:00Z",
        processedAt: null,
        blockedReason: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain("subjectId");
    expect(request(fetchMock, 0)).toEqual({
      method: "POST",
      body: { reason: "Artık kullanmıyorum" },
      url: "https://api.example.test/legal/account-deletion",
    });
    expect(cookieStore.delete).not.toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).not.toHaveBeenCalledWith("koala_rt");
    expect(revalidatePath).toHaveBeenCalledWith("/panel/hesap");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/hesap");
  });

  it("512 karakteri aşan gerekçeyi backend'e göndermeden reddeder ve değeri state'e yansıtmaz", async () => {
    const reason = "k".repeat(513);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAccountDeletionAction(
      { status: "idle" },
      fields({ confirmation: "account-deletion-irrevocable", reason }),
    );

    expect(result).toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { reason: "Silme nedeni en fazla 512 karakter olabilir." },
    });
    expect(JSON.stringify(result)).not.toContain(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hesap silme hatasında backend metni yerine stabil kodu ve destek kimliğini döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          errorCode: "UPSTREAM_UNAVAILABLE",
          errorCategory: "UPSTREAM_FAILED",
          message: "İç sistem ayrıntısı ve kişisel veri",
          requestId: deletionRequestId,
        }),
      ),
    );

    const result = await requestAccountDeletionAction(
      { status: "idle" },
      fields({ confirmation: "account-deletion-irrevocable", reason: "" }),
    );

    expect(result).toEqual({
      status: "error",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
      requestId: deletionRequestId,
    });
    expect(JSON.stringify(result)).not.toContain("kişisel veri");
  });

  it("yarışta oluşan duplicate talebi mevcut bekleyen durumla idempotent gösterir", async () => {
    const deletion = {
      id: "1b1ad05a-e5a7-4b78-893e-ac0901818671",
      subjectId: "38a790b9-5212-438b-a3cd-1305b5b35ebf",
      status: "REQUESTED",
      requestedAt: "2026-09-09T09:30:00Z",
      processedAt: null,
      blockedReason: "Devam eden işiniz varken hesabınız silinemez.",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          success: false,
          errorCode: "LEGAL_DELETION_ALREADY_REQUESTED",
          errorCategory: "DATA_CONFLICT",
          message: "Ham duplicate metni",
          requestId: duplicateRequestId,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope(deletion)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAccountDeletionAction(
      { status: "idle" },
      fields({ confirmation: "account-deletion-irrevocable", reason: "" }),
    );

    expect(result).toEqual({
      status: "done",
      outcome: "already-requested",
      deletion: {
        status: "REQUESTED",
        requestedAt: "2026-09-09T09:30:00Z",
        processedAt: null,
        blockedReason: "Devam eden işiniz varken hesabınız silinemez.",
      },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/legal/account-deletion",
      "https://api.example.test/legal/account-deletion",
    ]);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).cache).toBe("no-store");
  });

  it("duplicate sonrası durum okunamazsa ilk stabil kodu ve requestId'yi korur", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          success: false,
          errorCode: "LEGAL_DELETION_ALREADY_REQUESTED",
          errorCategory: "DATA_CONFLICT",
          message: "Ham duplicate metni",
          requestId: duplicateRequestId,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(503, {
          success: false,
          errorCode: "UPSTREAM_UNAVAILABLE",
          errorCategory: "UPSTREAM_FAILED",
          message: "İç servis metni",
          requestId: "3415e938-1978-49bc-a867-38fc46337151",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestAccountDeletionAction(
        { status: "idle" },
        fields({ confirmation: "account-deletion-irrevocable", reason: "" }),
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "LEGAL_DELETION_ALREADY_REQUESTED",
      httpStatus: 409,
      requestId: duplicateRequestId,
    });
  });

  it("mutation sırasında süresi dolan oturumu hata state'ine çevirmeden girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse(401, {
          success: false,
          errorCode: "UNAUTHORIZED",
          errorCategory: "AUTHENTICATION",
          message: "Oturum sona erdi.",
        }),
      ),
    );

    await expect(
      addBankAccountAction({ status: "idle" }, fields({ iban: rawIban })),
    ).rejects.toThrow(redirectTo("/giris?next=%2Fpanel%2Fhesap"));

    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
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

  it("IBAN doğrulama talimatını state'e taşır; 409'u koduyla döndürür", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          envelope({
            accountId,
            maskedIban: "TR33 **** **** **** **** **13 26",
            status: "PENDING",
            reference: "KOALA-7Q2M",
            amount: 1.37,
            targetIban: "TR900006200000000000000001",
            expiresAt: null,
            attemptsLeft: 3,
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(409, {
          success: false,
          httpStatus: 409,
          errorCode: "USER_BANK_ACCOUNT_ALREADY_VERIFIED",
          errorCategory: "CONFLICT",
          message: "ham mesaj",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startBankAccountVerificationAction({ status: "idle" }, fields({ accountId })),
    ).resolves.toEqual({
      status: "done",
      ibanVerification: {
        accountId,
        maskedIban: "TR33 **** **** **** **** **13 26",
        status: "PENDING",
        reference: "KOALA-7Q2M",
        amount: "1.37",
        currency: "TRY",
        targetIban: "TR900006200000000000000001",
        expiresAt: null,
        attemptsLeft: 3,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/panel/kazanclarim");

    await expect(
      startBankAccountVerificationAction({ status: "idle" }, fields({ accountId })),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "USER_BANK_ACCOUNT_ALREADY_VERIFIED",
      httpStatus: 409,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/users/me/bank-accounts/${accountId}/verification`,
    );

    await expect(
      startBankAccountVerificationAction({ status: "idle" }, fields({ accountId: "nope" })),
    ).resolves.toMatchObject({ fieldErrors: { accountId: "Kaynak kimliği geçerli değil." } });
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

  it("ikinci sayfadaki tekil okuma işleminden sonra backend refetch'i kalıcı durumu getirir", async () => {
    const notification = {
      id: notificationId,
      channel: "IN_APP",
      category: "APPLICATION_UPDATES",
      subject: "Eski vardiya hatırlatması",
      body: "Vardiya ayrıntılarını gözden geçir.",
      targetType: "JOB_ASSIGNMENT",
      targetId: "5c5e3b10-77f4-41c2-ac33-bc1403879e39",
      status: "SENT",
      sentAt: "2026-09-05T11:30:00Z",
      readAt: null,
    };
    const page = (readAt: string | null) => ({
      notifications: {
        content: [{ ...notification, readAt }],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
        first: false,
        last: true,
      },
      unreadCount: readAt ? 0 : 1,
    });
    const readAt = "2026-09-06T17:00:00Z";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(page(null))))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(page(readAt))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotifications(1)).resolves.toMatchObject({
      notifications: { content: [{ id: notificationId, readAt: null }] },
    });
    await expect(
      markNotificationReadAction({ status: "idle" }, fields({ notificationId })),
    ).resolves.toEqual({ status: "done" });
    await expect(listNotifications(1)).resolves.toMatchObject({
      notifications: { content: [{ id: notificationId, readAt }] },
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me/notifications?page=1",
      `https://api.example.test/users/me/notifications/${notificationId}/read`,
      "https://api.example.test/users/me/notifications?page=1",
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/panel/hesap");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/hesap");
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
