import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  blockConversationUserAction,
  confirmConversationAccessAction,
  loadConversationsAction,
  loadConversationSummaryAction,
  loadOlderMessagesAction,
  markConversationReadAction,
  reportMessageAction,
  sendMessageAction,
  unblockConversationUserAction,
} from "./messaging-actions";
import { conversationListPageSize } from "@/messaging/contract";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const conversationId = "33333333-3333-4333-8333-333333333333";
const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("mesajlaşma Server Action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/panel/mesajlar/${conversationId}`);
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("geçersiz kimliği veya boş mesajı backend'e göndermeden reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMessageAction("not-an-id", "Merhaba")).resolves.toMatchObject({ ok: false });
    await expect(sendMessageAction(conversationId, "   ")).resolves.toMatchObject({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403 yanıtını ham backend mesajını taşımadan kilitleme kararına dönüştürür", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      success: false,
      errorCode: "USER_BLOCKED",
      errorCategory: "BUSINESS",
      message: "private backend detail",
    })));

    await expect(sendMessageAction(conversationId, "Merhaba")).resolves.toEqual({
      ok: false,
      errorCode: "USER_BLOCKED",
      status: 403,
      blocked: true,
    });
  });

  it("erişim kanıtını REST geçmişi başarıyla okunmadan vermez", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, envelope({
      content: [], page: 0, totalElements: 0, totalPages: 0, last: true,
    }))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(confirmConversationAccessAction(conversationId)).resolves.toBe(true);
    await expect(loadOlderMessagesAction(conversationId, 2)).resolves.toMatchObject({
      ok: true,
      page: { page: 0 },
    });
    await expect(markConversationReadAction(conversationId)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("özet yenilemesinde oturum sahibini sunucuda çözüp gerçek kapalı durumu döndürür", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: "11111111-1111-4111-8111-111111111111",
        firstName: "Deniz",
        lastName: "Ak",
        email: "deniz@example.test",
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          jobId: null,
          jobTitle: null,
          kind: "GROUP",
          participants: [],
          lastMessageAt: null,
          lastMessageBody: null,
          unreadCount: 0,
          closed: true,
        }],
        page: 0,
        totalElements: 1,
        totalPages: 1,
        last: true,
      })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadConversationSummaryAction(conversationId)).resolves.toMatchObject({
      ok: true,
      conversation: { id: conversationId, closed: true },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me",
      "https://api.example.test/conversations?page=0&size=100",
    ]);
  });

  it("load-more sayfasını ortak 100 kayıtlık lookup sözleşmesiyle etiketler", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: viewerId })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          kind: "DIRECT",
          participants: [{ id: viewerId }, { id: otherId }],
          closed: false,
        }],
        page: 3,
        totalPages: 4,
        totalElements: 301,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadConversationsAction(3)).resolves.toMatchObject({
      ok: true,
      page: {
        page: 3,
        content: [{ id: conversationId, sourcePage: 3 }],
      },
    });
    expect(conversationListPageSize).toBe(100);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.example.test/conversations?page=3&size=${conversationListPageSize}`,
      expect.anything(),
    );
  });

  it("reddedilen topic erişimini ham backend mesajını fırlatmadan false yapar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      success: false,
      errorCode: "FORBIDDEN",
      errorCategory: "BUSINESS",
      message: "private participant detail",
    })));

    await expect(confirmConversationAccessAction(conversationId)).resolves.toBe(false);
  });

  it("engellenecek kullanıcıyı istemciden almadan katılımcı konuşmasından türetir", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: viewerId })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          kind: "DIRECT",
          participants: [{ id: viewerId }, { id: otherId }],
          closed: false,
        }],
        page: 0,
        totalPages: 1,
        totalElements: 1,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(blockConversationUserAction(conversationId, 3)).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://api.example.test/users/me/blocks/${otherId}`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({}) }),
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me",
      "https://api.example.test/conversations?page=3&size=100",
      `https://api.example.test/users/me/blocks/${otherId}`,
    ]);
  });

  it("tahrif edilmiş conversation sayfasında counterpart lookup yapmadan fail-closed kalır", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(blockConversationUserAction(conversationId, 10_001)).resolves.toMatchObject({
      ok: false,
      errorCode: "VALIDATION_FAILED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("metin olmayan konuşma kimliğiyle engelleme isteğini backend'e göndermeden reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(blockConversationUserAction(
      [conversationId] as unknown as string,
    )).resolves.toMatchObject({ ok: false, errorCode: "VALIDATION_FAILED" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bilinmeyen gerekçeyi ve uzun açıklamayı backend'e ulaşmadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      "77777777-7777-4777-8777-777777777777",
      "NOT_A_REASON",
      "a".repeat(2_001),
    )).resolves.toMatchObject({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serileştirilmiş ama metin olmayan şikâyet girdisini güvenli biçimde reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      "77777777-7777-4777-8777-777777777777",
      "SPAM",
      null as never,
    )).resolves.toMatchObject({ ok: false, errorCode: "VALIDATION_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("şikâyet hatasını ham metinsiz ve takip edilebilir requestId ile döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {
      success: false,
      errorCode: "SERVICE_UNAVAILABLE",
      errorCategory: "SYSTEM",
      message: "contains private target detail",
      requestId: "request-report-117",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      "77777777-7777-4777-8777-777777777777",
      "SPAM",
      "",
    )).resolves.toEqual({
      ok: false,
      errorCode: "SERVICE_UNAVAILABLE",
      status: 503,
      blocked: false,
      requestId: "request-report-117",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mesaj şikâyeti POST isteği reject olursa ham hata fırlatmadan normalize eder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private network detail")));

    await expect(reportMessageAction(
      conversationId,
      "77777777-7777-4777-8777-777777777777",
      "SPAM",
      "",
    )).resolves.toEqual({
      ok: false,
      errorCode: "UNEXPECTED",
      status: 500,
      blocked: false,
    });
  });

  it("mesaj şikâyetini ön tarama yapmadan yalnız kanonik payload ile bir kez yollar", async () => {
    const messageId = "77777777-7777-4777-8777-777777777777";
    const reportId = "88888888-8888-4888-8888-888888888888";
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      jsonResponse(201, envelope({ id: reportId })),
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      messageId,
      "INAPPROPRIATE_CONTENT",
      "",
    )).resolves.toEqual({ ok: true, reportId });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/reports");
    expect(JSON.parse(String(init.body))).toEqual({
      messageId,
      reason: "INAPPROPRIATE_CONTENT",
    });
  });

  it("aynı mesaj şikâyeti retry'ında aynı payload'ı yollar ve backend'in aynı rapor kimliğini taşır", async () => {
    const messageId = "77777777-7777-4777-8777-777777777777";
    const reportId = "88888888-8888-4888-8888-888888888888";
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      jsonResponse(201, envelope({ id: reportId })),
    ));
    vi.stubGlobal("fetch", fetchMock);

    const first = await reportMessageAction(
      conversationId,
      messageId,
      "HARASSMENT",
      "  rahatsız edici  ",
    );
    const retry = await reportMessageAction(
      conversationId,
      messageId,
      "HARASSMENT",
      "rahatsız edici",
    );

    expect(first).toEqual({ ok: true, reportId });
    expect(retry).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { messageId, reason: "HARASSMENT", description: "rahatsız edici" },
      { messageId, reason: "HARASSMENT", description: "rahatsız edici" },
    ]);
  });

  it("engel kaldırmayı da katılımcı konuşmasından türetilen kullanıcıya yollar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: viewerId })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          kind: "DIRECT",
          participants: [{ id: viewerId }, { id: otherId }],
          closed: false,
        }],
        page: 0,
        totalPages: 1,
        totalElements: 1,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(unblockConversationUserAction(conversationId)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://api.example.test/users/me/blocks/${otherId}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/users/me",
      "https://api.example.test/conversations?page=0&size=100",
      `https://api.example.test/users/me/blocks/${otherId}`,
    ]);
  });

  it("aynı mesaj için değişen payload'ın backend 409 ve requestId sonucunu korur", async () => {
    const messageId = "77777777-7777-4777-8777-777777777777";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, envelope({
        id: "88888888-8888-4888-8888-888888888888",
      })))
      .mockResolvedValueOnce(jsonResponse(409, {
        success: false,
        errorCode: "REPORT_IDEMPOTENCY_CONFLICT",
        errorCategory: "CONFLICT",
        message: "private persisted report detail",
        requestId: "request-report-conflict-117",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      messageId,
      "HARASSMENT",
      "rahatsız edici",
    )).resolves.toEqual({
      ok: true,
      reportId: "88888888-8888-4888-8888-888888888888",
    });
    await expect(reportMessageAction(
      conversationId,
      messageId,
      "FRAUD",
      "başka şikâyet",
    )).resolves.toEqual({
      ok: false,
      errorCode: "REPORT_IDEMPOTENCY_CONFLICT",
      status: 409,
      blocked: false,
      requestId: "request-report-conflict-117",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: "katılımcı olmayan kullanıcı için mesaj varlığını gizleyen 404",
      status: 404,
      errorCode: "MESSAGING_MESSAGE_NOT_FOUND",
    },
    {
      name: "kendi mesajını şikâyet eden kullanıcı için 400",
      status: 400,
      errorCode: "REPORT_CANNOT_REPORT_SELF",
    },
  ])("$name sonucunu ön tarama olmadan korur", async ({ status, errorCode }) => {
    const messageId = "77777777-7777-4777-8777-777777777777";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {
      success: false,
      errorCode,
      errorCategory: "BUSINESS",
      message: "private backend detail",
      requestId: "request-report-authz-117",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportMessageAction(
      conversationId,
      messageId,
      "HARASSMENT",
      "rahatsız edici",
    )).resolves.toEqual({
      ok: false,
      errorCode,
      status,
      blocked: false,
      requestId: "request-report-authz-117",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/reports",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
