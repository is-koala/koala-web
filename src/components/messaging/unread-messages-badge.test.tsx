import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeEvent,
  RealtimeEventListener,
} from "@/realtime/client";

import { UnreadMessagesBadge } from "./unread-messages-badge";

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const conversationId = "33333333-3333-4333-8333-333333333333";

describe("üst bar okunmamış rozeti", () => {
  it("kişisel MESSAGE ile artar, kullanıcının READ olayıyla konuşma sayısını düşürür", async () => {
    const realtime = new BadgeRealtime();
    render(
      <UnreadMessagesBadge
        viewerId={viewerId}
        href="/panel/mesajlar"
        realtimeClient={realtime}
        loadUnread={vi.fn().mockResolvedValue({
          ok: true,
          state: { total: 2, byConversation: { [conversationId]: 2 } },
        })}
      />,
    );

    await waitFor(() => expect(screen.getByRole("link", { name: "2 okunmamış mesaj" })).toBeVisible());
    act(() => realtime.emit({
      type: "MESSAGE",
      conversationId,
      userId: otherId,
      message: {
        id: "44444444-4444-4444-8444-444444444444",
        senderId: otherId,
        body: "Yeni",
        sentAt: "2026-09-06T11:00:00Z",
        readAt: null,
      },
      online: null,
      at: "2026-09-06T11:00:00Z",
      error: null,
    }));
    expect(screen.getByRole("link", { name: "3 okunmamış mesaj" })).toBeVisible();

    act(() => realtime.emit({
      type: "READ",
      conversationId,
      userId: viewerId,
      message: null,
      online: null,
      at: "2026-09-06T11:01:00Z",
      error: null,
    }));
    expect(screen.queryByText("3")).toBeNull();
    expect(screen.getByRole("link", { name: "Okunmamış mesaj yok" })).toBeVisible();
  });

  it("ilk REST görüntüsüne zaten giren canlı mesajı ikinci kez saymaz", async () => {
    const realtime = new BadgeRealtime();
    let resolveInitial!: (result: {
      ok: true;
      state: { total: number; byConversation: Record<string, number> };
    }) => void;
    const snapshot: {
      ok: true;
      state: { total: number; byConversation: Record<string, number> };
    } = {
      ok: true,
      state: { total: 1, byConversation: { [conversationId]: 1 } },
    };
    const loadUnread = vi.fn()
      .mockImplementationOnce(() => new Promise<typeof snapshot>((resolve) => { resolveInitial = resolve; }))
      .mockResolvedValueOnce(snapshot);
    render(
      <UnreadMessagesBadge
        viewerId={viewerId}
        href="/panel/mesajlar"
        realtimeClient={realtime}
        loadUnread={loadUnread}
      />,
    );

    await waitFor(() => expect(realtime.listener).not.toBeNull());
    act(() => realtime.emit({
      type: "MESSAGE",
      conversationId,
      userId: otherId,
      message: {
        id: "44444444-4444-4444-8444-444444444444",
        senderId: otherId,
        body: "REST'e de giren mesaj",
        sentAt: "2026-09-06T11:00:00Z",
        readAt: null,
      },
      online: null,
      at: "2026-09-06T11:00:00Z",
      error: null,
    }));

    await act(async () => resolveInitial(snapshot));
    await waitFor(() => expect(loadUnread).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("link", { name: "1 okunmamış mesaj" })).toBeVisible();
  });
});

class BadgeRealtime implements RealtimeClient {
  listener: RealtimeEventListener | null = null;
  state: RealtimeConnectionState = { phase: "live", mode: "realtime" };
  start = vi.fn();
  stop = vi.fn();
  getState = () => this.state;
  onStateChange(listener: (state: RealtimeConnectionState) => void) {
    listener(this.state);
    return () => undefined;
  }
  listenToMessages(listener: RealtimeEventListener) {
    this.listener = listener;
    return () => { this.listener = null; };
  }
  followConversation = vi.fn(async () => () => undefined);
  followPresence = vi.fn(async () => () => undefined);
  sendTyping = vi.fn(() => true);
  emit(event: RealtimeEvent) { this.listener?.(event); }
}
