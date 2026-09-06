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
  const eventRevision = useRef(0);
  const client = useMemo(() => realtimeClient ?? sharedRealtimeClient(), [realtimeClient]);

  useEffect(() => {
    let active = true;
    const release = retainRealtimeClient(client);
    initialLoaded.current = false;
    eventRevision.current = 0;
    seenMessages.current.clear();
    const removeMessages = client.listenToMessages((event) => {
      if (!event.conversationId) return;
      if (event.type === "MESSAGE") {
        const message = messageFromRealtime(event.message);
        if (!message || message.senderId === viewerId || seenMessages.current.has(message.id)) return;
        seenMessages.current.add(message.id);
        if (!initialLoaded.current) {
          eventRevision.current += 1;
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
          eventRevision.current += 1;
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
    void loadStableUnreadState();

    async function loadStableUnreadState() {
      while (active) {
        const revision = eventRevision.current;
        const result = await loadUnread();
        if (!active) return;
        if (!result.ok) {
          initialLoaded.current = true;
          return;
        }
        if (revision !== eventRevision.current) continue;
        initialLoaded.current = true;
        setUnread(result.state);
        return;
      }
    }
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
