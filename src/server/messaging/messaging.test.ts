import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  blockUser,
  getConversation,
  getConversationMessages,
  getConversations,
  getUnreadState,
  isUserBlockedByViewer,
  markConversationRead,
  openWorkerConversation,
  reportContent,
  sendConversationMessage,
  unblockUser,
} from "./messaging";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const conversationId = "33333333-3333-4333-8333-333333333333";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("mesajlaşma backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("konuşmaları görünür alanlara daraltır ve karşı tarafın presence bilgisini toplu okur", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          jobId: "44444444-4444-4444-8444-444444444444",
          jobTitle: "Akşam vardiyası",
          kind: "DIRECT",
          employer: { id: viewerId, firstName: "Deniz", lastName: "Ak" },
          worker: { id: otherId, firstName: "Ece", lastName: "Yılmaz", profilePictureUrl: null },
          participants: [
            { id: viewerId, firstName: "Deniz", lastName: "Ak" },
            { id: otherId, firstName: "Ece", lastName: "Yılmaz", profilePictureUrl: null },
          ],
          lastMessageAt: "2026-09-06T11:00:00Z",
          lastMessageBody: "Yarın görüşürüz",
          unreadCount: 2,
          closed: false,
          internalFlag: "must-not-cross-the-boundary",
        }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([
        { userId: otherId, online: true, lastSeenAt: "2026-09-06T10:59:00Z" },
      ])));
    vi.stubGlobal("fetch", fetchMock);

    const page = await getConversations(viewerId, 0, 20);

    expect(page).toEqual({
      content: [{
        id: conversationId,
        jobId: "44444444-4444-4444-8444-444444444444",
        jobTitle: "Akşam vardiyası",
        kind: "DIRECT",
        displayName: "Ece Yılmaz",
        participantCount: 2,
        participantNames: ["Ece Yılmaz"],
        participants: [
          {
            id: viewerId,
            name: "Deniz Ak",
            profilePictureUrl: null,
            role: null,
            joinedAt: null,
            lastReadAt: null,
            left: false,
          },
          {
            id: otherId,
            name: "Ece Yılmaz",
            profilePictureUrl: null,
            role: null,
            joinedAt: null,
            lastReadAt: null,
            left: false,
          },
        ],
        readReceipts: false,
        profilePictureUrl: null,
        counterpartId: otherId,
        lastMessageAt: "2026-09-06T11:00:00Z",
        lastMessageBody: "Yarın görüşürüz",
        unreadCount: 2,
        closed: false,
        online: true,
        sourcePage: 0,
      }],
      page: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/conversations?page=0&size=20",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual([otherId]);
  });

  it("grup sohbetini ilan başlığı ve görüntüleyen dışındaki katılımcılarla özetler", async () => {
    // Grup ilan başına kuruluyor ve şirket yetkilileri de katılımcı
    // (is-koala/koala-backend#257). Tek bir karşı taraf olmadığı için
    // presence sorgusu ve avatar kapalı; ad listesi görüntüleyeni düşüyor.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [{
        id: conversationId,
        jobId: "44444444-4444-4444-8444-444444444444",
        jobTitle: "Depo sayımı",
        kind: "GROUP",
        participants: [
          { id: viewerId, firstName: "Deniz", lastName: "Ak" },
          { id: otherId, firstName: "Ece", lastName: "Yılmaz" },
          { id: "third-user", firstName: "", lastName: "", username: "mkaya" },
          { id: "fourth-user" },
        ],
        lastMessageAt: null,
        lastMessageBody: null,
        unreadCount: 0,
        closed: false,
      }],
      page: 0,
      totalElements: 1,
      totalPages: 1,
      last: true,
    })));
    vi.stubGlobal("fetch", fetchMock);

    const page = await getConversations(viewerId, 0, 20);

    expect(page.content[0]).toMatchObject({
      kind: "GROUP",
      displayName: "Depo sayımı",
      jobTitle: "Depo sayımı",
      participantCount: 4,
      participantNames: ["Ece Yılmaz", "mkaya"],
      counterpartId: null,
      profilePictureUrl: null,
      online: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("#281 katılımcı sözleşmesini rol, katılma ve okuma damgasıyla taşır; ayrılanı sayıdan düşer", async () => {
    // `ConversationParticipantDto` (is-koala/koala-backend#281): ayrılan
    // `left=true` ile listede kalıyor ki eski mesajlarının adı çözülsün, ama
    // satırın "4 katılımcı" sayısı ve ad listesi yalnız aktifleri anlatır.
    // `lastReadAt` alanının varlığı "görüldü"nün çizilip çizilmeyeceğini
    // söylüyor; tanınmayan rol uydurulmaz, `null` kalır.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [{
        id: conversationId,
        jobId: "44444444-4444-4444-8444-444444444444",
        jobTitle: "Depo sayımı",
        kind: "GROUP",
        participants: [
          {
            id: viewerId, firstName: "Deniz", lastName: "Ak", profilePictureUrl: null,
            role: "EMPLOYER", joinedAt: "2026-09-01T09:00:00Z",
            lastReadAt: "2026-09-06T12:00:00Z", left: false,
          },
          {
            id: otherId, firstName: "Ece", lastName: "Yılmaz", profilePictureUrl: "https://cdn.example.test/ece.webp",
            role: "WORKER", joinedAt: "2026-09-02T09:00:00Z", lastReadAt: null, left: false,
          },
          {
            id: "third-user", firstName: "Mehmet", lastName: "Kaya", profilePictureUrl: null,
            role: "COMPANY_CONTACT", joinedAt: "2026-09-01T09:00:00Z",
            lastReadAt: "2026-09-03T09:00:00Z", left: true,
          },
          {
            id: "fourth-user", firstName: "Anonim", lastName: "Kullanıcı", profilePictureUrl: null,
            role: "SOMETHING_NEW", joinedAt: "2026-09-02T09:00:00Z", lastReadAt: null, left: false,
          },
        ],
        lastMessageAt: null,
        lastMessageBody: null,
        unreadCount: 0,
        closed: false,
      }],
      page: 0,
      totalElements: 1,
      totalPages: 1,
      last: true,
    }))));

    const page = await getConversations(viewerId, 0, 20);

    expect(page.content[0]).toMatchObject({
      kind: "GROUP",
      participantCount: 3,
      participantNames: ["Ece Yılmaz", "Anonim Kullanıcı"],
      readReceipts: true,
      participants: [
        {
          id: viewerId, name: "Deniz Ak", role: "EMPLOYER", joinedAt: "2026-09-01T09:00:00Z",
          lastReadAt: "2026-09-06T12:00:00Z", left: false,
        },
        {
          id: otherId, name: "Ece Yılmaz", role: "WORKER",
          profilePictureUrl: "https://cdn.example.test/ece.webp", lastReadAt: null, left: false,
        },
        {
          id: "third-user", name: "Mehmet Kaya", role: "COMPANY_CONTACT",
          lastReadAt: "2026-09-03T09:00:00Z", left: true,
        },
        { id: "fourth-user", name: "Anonim Kullanıcı", role: null, left: false },
      ],
    });
  });

  it("mesajın senderName alanını taşır; eski sunucuda null bırakır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [
        {
          id: "66666666-6666-4666-8666-666666666666", senderId: otherId, senderName: "Ece Yılmaz",
          senderProfilePictureUrl: null, body: "Yeni sunucu", sentAt: "2026-09-06T11:01:00Z", readAt: null,
        },
        {
          id: "55555555-5555-4555-8555-555555555555", senderId: otherId,
          body: "Eski sunucu", sentAt: "2026-09-06T11:00:00Z", readAt: null,
        },
      ],
      page: 0, totalElements: 2, totalPages: 1, last: true,
    }))));

    const page = await getConversationMessages(conversationId);

    expect(page.content).toEqual([
      {
        id: "55555555-5555-4555-8555-555555555555", senderId: otherId, senderName: null,
        body: "Eski sunucu", sentAt: "2026-09-06T11:00:00Z", readAt: null,
      },
      {
        id: "66666666-6666-4666-8666-666666666666", senderId: otherId, senderName: "Ece Yılmaz",
        body: "Yeni sunucu", sentAt: "2026-09-06T11:01:00Z", readAt: null,
      },
    ]);
    expect(page.content[1]).not.toHaveProperty("senderProfilePictureUrl");
  });

  it("çalışan tarafında konuşmayı workerId göndermeden açar", async () => {
    // Parametre yokken backend çağıranı işçi sayıyor (`MessagingManager.java:91`);
    // işverenin yolu `openApplicantConversation` ve orada `workerId` zorunlu.
    const jobId = "44444444-4444-4444-8444-444444444444";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ id: conversationId, jobId, kind: "GROUP" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(openWorkerConversation(jobId)).resolves.toBe(conversationId);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/jobs/${jobId}/conversation`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("presence uç noktası çalışmasa da konuşma listesini REST üzerinden döndürür", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{
          id: conversationId,
          jobId: null,
          jobTitle: null,
          kind: "DIRECT",
          participants: [
            { id: viewerId, firstName: "Deniz", lastName: "Ak" },
            { id: otherId, firstName: "Ece", lastName: "Yılmaz" },
          ],
          lastMessageAt: null,
          lastMessageBody: null,
          unreadCount: 0,
          closed: false,
        }],
        page: 0,
        totalElements: 1,
        totalPages: 1,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(503, {
        success: false,
        errorCode: "SERVICE_UNAVAILABLE",
        errorCategory: "SYSTEM",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getConversations(viewerId)).resolves.toMatchObject({
      content: [expect.objectContaining({ counterpartId: otherId, online: null })],
    });
  });

  it("newest-first geçmiş sayfasını konuşma sırasına çevirir", async () => {
    const newest = message("66666666-6666-4666-8666-666666666666", "İkinci", "2026-09-06T11:01:00Z");
    const oldest = message("55555555-5555-4555-8555-555555555555", "Birinci", "2026-09-06T11:00:00Z");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [newest, oldest], page: 0, totalElements: 2, totalPages: 1, last: true,
    }))));

    await expect(getConversationMessages(conversationId)).resolves.toEqual({
      content: [oldest, newest],
      page: 0,
      totalPages: 1,
      totalElements: 2,
      last: true,
    });
  });

  it("mesaj gönderme ve okundu işlemlerini kanonik uçlara yollar", async () => {
    const sent = message("77777777-7777-4777-8777-777777777777", "Merhaba", "2026-09-06T11:02:00Z");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(sent)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendConversationMessage(conversationId, "Merhaba")).resolves.toEqual(sent);
    await markConversationRead(conversationId);

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: `https://api.example.test/conversations/${conversationId}/messages`,
      method: "POST",
      body: JSON.stringify({ body: "Merhaba" }),
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: `https://api.example.test/conversations/${conversationId}/read`,
      method: "POST",
    });
  });

  it("engelleme ve engel kaldırmayı oturum sahibinin kanonik uçlarına yollar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await blockUser(otherId);
    await unblockUser(otherId);

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: `https://api.example.test/users/me/blocks/${otherId}`,
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: `https://api.example.test/users/me/blocks/${otherId}`,
      method: "DELETE",
    });
  });

  it("şikâyeti yalnız seçilen hedef, gerekçe ve açıklamayla gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({
      id: "99999999-9999-4999-8999-999999999999",
      reason: "HARASSMENT",
      description: "Israrlı mesajlar",
      status: "OPEN",
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reportContent(
      { messageId: "77777777-7777-4777-8777-777777777777" },
      "HARASSMENT",
      "Israrlı mesajlar",
    )).resolves.toMatchObject({ id: "99999999-9999-4999-8999-999999999999" });

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: "https://api.example.test/reports",
      method: "POST",
      body: JSON.stringify({
        messageId: "77777777-7777-4777-8777-777777777777",
        reason: "HARASSMENT",
        description: "Israrlı mesajlar",
      }),
    });
  });

  it("engel durumunu yalnız oturum sahibinin engel listesinden belirler", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        blocked: { id: otherId, firstName: "Ece", lastName: "Yılmaz" },
        reason: "private moderation note",
        createdAt: "2026-09-07T12:00:00Z",
      },
    ])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(isUserBlockedByViewer(otherId)).resolves.toBe(true);
    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: "https://api.example.test/users/me/blocks",
      method: "GET",
    });
  });

  it("konuşma özetini yalnız server-doğrulamalı ipucu sayfasında arayıp fan-out yapmaz", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page") ?? 0);
      return jsonResponse(200, envelope({
        content: page === 3 ? [{
          id: conversationId,
          kind: "GROUP",
          participants: [{ id: viewerId }, { id: otherId }, { id: "third-user" }],
          closed: false,
        }] : [],
        page,
        totalPages: 4,
        totalElements: 1,
        last: page === 3,
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getConversation(viewerId, conversationId, 3)).resolves.toMatchObject({
      id: conversationId,
      sourcePage: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/conversations?page=3&size=100",
      expect.anything(),
    );
  });

  it("ipucu sayfasındaki farklı conversation kimliğini counterpart olarak kabul etmez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({
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
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getConversation(
      viewerId,
      "99999999-9999-4999-8999-999999999999",
      3,
    )).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("üst bar için tüm sayfalardaki okunmamışları conversation kimliğiyle toplar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [conversation({ id: conversationId, unreadCount: 2 })],
        page: 0, totalElements: 2, totalPages: 2, last: false,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [conversation({
          id: "88888888-8888-4888-8888-888888888888",
          unreadCount: 3,
        })],
        page: 1, totalElements: 2, totalPages: 2, last: true,
      })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUnreadState()).resolves.toEqual({
      total: 5,
      byConversation: {
        [conversationId]: 2,
        "88888888-8888-4888-8888-888888888888": 3,
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/conversations?page=1&size=100",
      expect.anything(),
    );
  });
});

function message(id: string, body: string, sentAt: string) {
  return { id, senderId: otherId, senderName: null, body, sentAt, readAt: null };
}

function conversation(overrides: { id: string; unreadCount: number }) {
  return {
    ...overrides,
    kind: "DIRECT",
    participants: [],
    closed: false,
    lastMessageAt: null,
    lastMessageBody: null,
  };
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, method: init.method, body: init.body };
}
