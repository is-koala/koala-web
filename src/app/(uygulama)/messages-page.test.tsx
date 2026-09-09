import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const getConversation = vi.hoisted(() => vi.fn());
const getConversationMessages = vi.hoisted(() => vi.fn());
const getConversations = vi.hoisted(() => vi.fn());
const conversationThread = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => {
  void props;
  return <div>Mesaj geçmişi</div>;
}));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/messaging/messaging", () => ({
  getConversation,
  getConversationMessages,
  getConversations,
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
});
