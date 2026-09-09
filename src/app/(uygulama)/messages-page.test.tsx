import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const getConversation = vi.hoisted(() => vi.fn());
const getConversationMessages = vi.hoisted(() => vi.fn());
const getConversations = vi.hoisted(() => vi.fn());
const isUserBlockedByViewer = vi.hoisted(() => vi.fn());
const conversationThread = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => {
  void props;
  return <div>Mesaj geçmişi</div>;
}));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/messaging/messaging", () => ({
  getConversation,
  getConversationMessages,
  getConversations,
  isUserBlockedByViewer,
}));
vi.mock("@/components/messaging/conversation-thread", () => ({
  ConversationThread: conversationThread,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), unstable_rethrow: vi.fn() }));

import { MessageThreadPage } from "./messages-page";

const viewerId = "11111111-1111-4111-8111-111111111111";
const conversationId = "33333333-3333-4333-8333-333333333333";

describe("mesaj konuşması sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: viewerId }, failure: null });
    getConversationMessages.mockResolvedValue({
      content: [{
        id: "44444444-4444-4444-8444-444444444444",
        senderId: viewerId,
        body: "Geçmiş okunabiliyor",
        sentAt: "2026-09-09T08:00:00Z",
        readAt: null,
      }],
      page: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
    });
    isUserBlockedByViewer.mockResolvedValue(false);
  });

  it("özet arızasını açık konuşma uydurmadan geçmişten bağımsız taşır", async () => {
    getConversation.mockRejectedValue(new ApiError({
      status: 503,
      errorCode: "SERVICE_UNAVAILABLE",
      errorCategory: "SYSTEM",
      message: "private backend detail",
    }));

    render(await MessageThreadPage({
      basePath: "/panel/mesajlar",
      params: Promise.resolve({ conversationId }),
    }));

    expect(screen.getByText("Mesaj geçmişi")).toBeVisible();
    expect(conversationThread).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        initialSummary: {
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        },
      }),
      undefined,
    );
    expect(conversationThread.mock.calls[0]?.[0]).not.toHaveProperty("conversation");
  });

  it("başarılı liste taramasında özet bulunamamasını da bilinmeyen durum sayar", async () => {
    getConversation.mockResolvedValue(null);

    render(await MessageThreadPage({
      basePath: "/panel/mesajlar",
      params: Promise.resolve({ conversationId }),
    }));

    expect(conversationThread).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSummary: {
          ok: false,
          errorCode: "UNEXPECTED",
          status: 0,
          blocked: false,
        },
      }),
      undefined,
    );
  });

  it("oturum sahibinin mevcut engelini ilk çizimde composer'a taşır", async () => {
    const otherId = "22222222-2222-4222-8222-222222222222";
    getConversation.mockResolvedValue({
      id: conversationId,
      jobId: null,
      jobTitle: null,
      displayName: "Ece Yılmaz",
      profilePictureUrl: null,
      counterpartId: otherId,
      lastMessageAt: null,
      lastMessageBody: null,
      unreadCount: 0,
      closed: false,
      online: null,
    });
    isUserBlockedByViewer.mockResolvedValue(true);

    render(await MessageThreadPage({
      basePath: "/panel/mesajlar",
      params: Promise.resolve({ conversationId }),
    }));

    expect(isUserBlockedByViewer).toHaveBeenCalledWith(otherId);
    expect(getConversation).toHaveBeenCalledWith(viewerId, conversationId, 0);
    expect(conversationThread).toHaveBeenCalledWith(
      expect.objectContaining({ initialBlockedByViewer: true }),
      undefined,
    );
  });

  it.each(["/panel/mesajlar", "/isveren/mesajlar"])(
    "%s sonraki sayfa ipucunu tek authoritative özet lookup'ına taşır",
    async (basePath) => {
      getConversation.mockResolvedValue({
        id: conversationId,
        jobId: null,
        jobTitle: null,
        displayName: "Ece Yılmaz",
        profilePictureUrl: null,
        counterpartId: null,
        lastMessageAt: null,
        lastMessageBody: null,
        unreadCount: 0,
        closed: false,
        online: null,
        sourcePage: 3,
      });

      render(await MessageThreadPage({
        basePath,
        params: Promise.resolve({ conversationId }),
        searchParams: Promise.resolve({ conversationPage: "3" }),
      }));

      expect(getConversation).toHaveBeenCalledWith(viewerId, conversationId, 3);
      expect(conversationThread).toHaveBeenCalledWith(
        expect.objectContaining({ conversationPage: 3 }),
        undefined,
      );
    },
  );

  it("tahrif edilmiş sayfa ipucunda özeti çağırmadan fail-closed kalır", async () => {
    render(await MessageThreadPage({
      basePath: "/panel/mesajlar",
      params: Promise.resolve({ conversationId }),
      searchParams: Promise.resolve({ conversationPage: "10001" }),
    }));

    expect(getConversation).not.toHaveBeenCalled();
    expect(conversationThread).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSummary: expect.objectContaining({ ok: false, status: 0 }),
      }),
      undefined,
    );
  });
});
