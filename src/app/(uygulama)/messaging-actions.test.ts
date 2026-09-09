import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  confirmConversationAccessAction,
  loadConversationSummaryAction,
  loadOlderMessagesAction,
  markConversationReadAction,
  sendMessageAction,
} from "./messaging-actions";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const conversationId = "33333333-3333-4333-8333-333333333333";
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

  it("reddedilen topic erişimini ham backend mesajını fırlatmadan false yapar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {
      success: false,
      errorCode: "FORBIDDEN",
      errorCategory: "BUSINESS",
      message: "private participant detail",
    })));

    await expect(confirmConversationAccessAction(conversationId)).resolves.toBe(false);
  });
});
