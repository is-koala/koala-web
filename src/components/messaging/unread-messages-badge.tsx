"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadUnreadStateAction } from "@/app/(uygulama)/messaging-actions";
import { messageFromRealtime } from "@/messaging/realtime";
import type { RealtimeClient } from "@/realtime/client";
import { retainRealtimeClient, sharedRealtimeClient } from "@/realtime/shared-client";

type UnreadState = { total: number; byConversation: Record<string, number> };
type UnreadResult =
  | { ok: true; state: UnreadState }
  | { ok: false; errorCode: string; status: number; blocked: boolean };

export function UnreadMessagesBadge({
  viewerId,
  href,
  realtimeClient,
  loadUnread = loadUnreadStateAction,
}: {
  viewerId: string;
  href: string;
  realtimeClient?: RealtimeClient;
  loadUnread?: () => Promise<UnreadResult>;
}) {
  const [unread, setUnread] = useState<UnreadState>({ total: 0, byConversation: {} });
  const seenMessages = useRef(new Set<string>());
  const initialLoaded = useRef(false);
  const pendingDeltas = useRef<Record<string, number>>({});
  const clearedBeforeLoad = useRef(new Set<string>());
  const client = useMemo(() => realtimeClient ?? sharedRealtimeClient(), [realtimeClient]);

  useEffect(() => {
    let active = true;
    const release = retainRealtimeClient(client);
    void loadUnread().then((result) => {
      if (!active) return;
      initialLoaded.current = true;
      if (!result.ok) return;
      const byConversation = { ...result.state.byConversation };
      clearedBeforeLoad.current.forEach((id) => { byConversation[id] = 0; });
      Object.entries(pendingDeltas.current).forEach(([id, count]) => {
        byConversation[id] = (byConversation[id] ?? 0) + count;
      });
      setUnread({
        total: Object.values(byConversation).reduce((sum, count) => sum + count, 0),
        byConversation,
      });
    });
    const removeMessages = client.listenToMessages((event) => {
      if (!event.conversationId) return;
      if (event.type === "MESSAGE") {
        const message = messageFromRealtime(event.message);
        if (!message || message.senderId === viewerId || seenMessages.current.has(message.id)) return;
        seenMessages.current.add(message.id);
        if (!initialLoaded.current) {
          pendingDeltas.current[event.conversationId] =
            (pendingDeltas.current[event.conversationId] ?? 0) + 1;
        }
        setUnread((current) => {
          const nextCount = (current.byConversation[event.conversationId!] ?? 0) + 1;
          return {
            total: current.total + 1,
            byConversation: { ...current.byConversation, [event.conversationId!]: nextCount },
          };
        });
      }
      if (event.type === "READ" && event.userId === viewerId) {
        if (!initialLoaded.current) {
          clearedBeforeLoad.current.add(event.conversationId);
          pendingDeltas.current[event.conversationId] = 0;
        }
        setUnread((current) => {
          const cleared = current.byConversation[event.conversationId!] ?? 0;
          return {
            total: Math.max(0, current.total - cleared),
            byConversation: { ...current.byConversation, [event.conversationId!]: 0 },
          };
        });
      }
    });
    return () => {
      active = false;
      removeMessages();
      release();
    };
  }, [client, loadUnread, viewerId]);

  const label = unread.total > 0 ? `${unread.total} okunmamış mesaj` : "Okunmamış mesaj yok";
  return (
    <Link className="message-badge-link" href={href} aria-label={label}>
      <span aria-hidden="true">Mesajlar</span>
      {unread.total > 0 ? <span className="message-badge" aria-hidden="true">{unread.total}</span> : null}
    </Link>
  );
}
