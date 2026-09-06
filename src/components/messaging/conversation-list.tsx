"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  confirmPresenceAccessAction,
  loadConversationsAction,
} from "@/app/(uygulama)/messaging-actions";
import type { ConversationSummary, Message, Page } from "@/messaging/contract";
import { messageFromRealtime } from "@/messaging/realtime";
import type { RealtimeClient, RealtimeConnectionState, RealtimeEvent } from "@/realtime/client";
import { retainRealtimeClient, sharedRealtimeClient } from "@/realtime/shared-client";

import { ConnectionStatus } from "./connection-status";

type Props = {
  initialPage: Page<ConversationSummary>;
  viewerId: string;
  basePath: string;
  realtimeClient?: RealtimeClient;
  confirmPresence?: (userId: string) => Promise<boolean>;
  loadPage?: (page: number) => Promise<ConversationPageResult>;
};

type ConversationPageResult =
  | { ok: true; page: Page<ConversationSummary> }
  | { ok: false; errorCode: string; status: number; blocked: boolean };

export function ConversationList({
  initialPage,
  viewerId,
  basePath,
  realtimeClient,
  confirmPresence = confirmPresenceAccessAction,
  loadPage = loadConversationsAction,
}: Props) {
  const [conversations, setConversations] = useState(initialPage.content);
  const [page, setPage] = useState(initialPage.page);
  const [hasMore, setHasMore] = useState(!initialPage.last);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [connection, setConnection] = useState<RealtimeConnectionState>({ phase: "idle", mode: "rest" });
  const conversationsRef = useRef(conversations);
  const refreshingConversationIds = useRef(new Set<string>());
  const pendingUnknownMessages = useRef(new Map<string, Map<string, Message>>());
  const client = useMemo(() => realtimeClient ?? sharedRealtimeClient(), [realtimeClient]);
  const presenceKey = [...new Set(conversations.flatMap((conversation) =>
    conversation.counterpartId === null ? [] : [conversation.counterpartId],
  ))].sort().join(",");

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const release = retainRealtimeClient(client);
    const removeState = client.onStateChange(setConnection);
    const removeMessages = client.listenToMessages((event) => {
      if (!event.conversationId) return;
      if (event.type === "MESSAGE") {
        const message = messageFromRealtime(event.message);
        if (!message) return;
        if (!conversationsRef.current.some((conversation) => conversation.id === event.conversationId)) {
          const missingId = event.conversationId;
          const pending = pendingUnknownMessages.current.get(missingId) ?? new Map<string, Message>();
          pending.set(message.id, message);
          pendingUnknownMessages.current.set(missingId, pending);
          if (refreshingConversationIds.current.has(missingId)) return;
          refreshingConversationIds.current.add(missingId);
          void loadPage(0).then((result) => {
            if (!result.ok) return;
            const refreshedIds = new Set(result.page.content.map((conversation) => conversation.id));
            const missingConversation = result.page.content.find((conversation) => conversation.id === missingId);
            if (!missingConversation) return;
            const pendingMessages = [...(pendingUnknownMessages.current.get(missingId)?.values() ?? [])];
            setConversations((current) => [
              ...result.page.content.map((conversation) =>
                conversation.id === missingId
                  ? updateConversationFromRefetch(conversation, pendingMessages, viewerId)
                  : conversation,
              ),
              ...current.filter((conversation) => !refreshedIds.has(conversation.id)),
            ].sort(byNewest));
          }).finally(() => {
            refreshingConversationIds.current.delete(missingId);
            pendingUnknownMessages.current.delete(missingId);
          });
          return;
        }
        setConversations((current) => current.map((conversation) =>
          conversation.id === event.conversationId
            ? updateConversationFromEvent(conversation, message, viewerId)
            : conversation,
        ).sort(byNewest));
      }
      if (event.type === "READ" && event.userId === viewerId) {
        setConversations((current) => current.map((conversation) =>
          conversation.id === event.conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ));
      }
    });
    const controller = new AbortController();
    const presenceDisposers: Array<() => void> = [];
    const counterpartIds = presenceKey ? presenceKey.split(",") : [];
    counterpartIds.forEach((userId) => {
      void client.followPresence(
        userId,
        async () => {
          if (!(await confirmPresence(userId))) throw new Error("presence access not confirmed");
        },
        (event) => updatePresence(event, userId, setConversations),
        controller.signal,
      ).then((dispose) => presenceDisposers.push(dispose)).catch(() => undefined);
    });
    return () => {
      controller.abort();
      presenceDisposers.forEach((dispose) => dispose());
      removeMessages();
      removeState();
      release();
    };
    // Yeni sayfa eklendiğinde presence abonelikleri yeni karşı taraflar için
    // tekrar kurulur; RealtimeClient aynı destination'ı wire'da tekilleştirir.
  }, [client, confirmPresence, loadPage, presenceKey, viewerId]);

  async function loadNextPage() {
    setLoadingMore(true);
    setLoadFailed(false);
    const result = await loadPage(page + 1);
    setLoadingMore(false);
    if (!result.ok) {
      setLoadFailed(true);
      return;
    }
    setConversations((current) => {
      const ids = new Set(current.map((item) => item.id));
      return [...current, ...result.page.content.filter((item) => !ids.has(item.id))];
    });
    setPage(result.page.page);
    setHasMore(!result.page.last);
  }

  if (conversations.length === 0) {
    return (
      <div role="status" className="state-card">
        <h2>Henüz mesaj yok</h2>
        <p>Konuşmaların başladığında burada görünecek.</p>
      </div>
    );
  }

  return (
    <section className="messages-page" aria-labelledby="messages-heading">
      <div className="messages-heading">
        <div>
          <p className="eyebrow">Mesajlar</p>
          <h1 id="messages-heading">Konuşmaların</h1>
        </div>
        <ConnectionStatus state={connection} />
      </div>
      <ul className="conversation-list">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link className="conversation-card" href={`${basePath}/${conversation.id}`}>
              <Avatar name={conversation.displayName} online={conversation.online} />
              <span className="conversation-copy">
                <span className="conversation-title-row">
                  <strong>{conversation.displayName}</strong>
                  {conversation.lastMessageAt ? <time dateTime={conversation.lastMessageAt}>
                    {shortDate(conversation.lastMessageAt)}
                  </time> : null}
                </span>
                <span className="conversation-job">{conversation.jobTitle ?? "Doğrudan konuşma"}</span>
                <span className="conversation-preview">
                  {conversation.lastMessageBody ?? "Henüz mesaj yok"}
                </span>
              </span>
              {conversation.unreadCount > 0 ? (
                <span className="conversation-unread" aria-label={`${conversation.unreadCount} okunmamış mesaj`}>
                  {conversation.unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {loadFailed ? <p role="alert" className="field-error">Konuşmalar yüklenemedi. Tekrar deneyebilirsin.</p> : null}
      {hasMore ? (
        <button className="button button-secondary button-small" type="button" onClick={loadNextPage} disabled={loadingMore}>
          {loadingMore ? "Yükleniyor…" : "Daha fazla konuşma"}
        </button>
      ) : null}
    </section>
  );
}

function Avatar({ name, online }: { name: string; online: boolean | null }) {
  return (
    <span className="message-avatar" aria-hidden="true">
      {name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "K"}
      {online === true ? <span className="presence-dot" /> : null}
    </span>
  );
}

function updatePresence(
  event: RealtimeEvent,
  userId: string,
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>,
) {
  if (event.type !== "PRESENCE" || event.userId !== userId || event.online === null) return;
  setConversations((current) => current.map((conversation) =>
    conversation.counterpartId === userId ? { ...conversation, online: event.online } : conversation,
  ));
}

function byNewest(left: ConversationSummary, right: ConversationSummary) {
  return Date.parse(right.lastMessageAt ?? "") - Date.parse(left.lastMessageAt ?? "");
}

function updateConversationFromEvent(
  conversation: ConversationSummary,
  message: Message,
  viewerId: string,
) {
  return {
    ...conversation,
    lastMessageAt: message.sentAt,
    lastMessageBody: message.body,
    unreadCount: message.senderId === viewerId
      ? conversation.unreadCount
      : conversation.unreadCount + 1,
  };
}

function updateConversationFromRefetch(
  conversation: ConversationSummary,
  messages: Message[],
  viewerId: string,
) {
  const latestMessage = messages.reduce<Message | null>((latest, candidate) =>
    latest === null || Date.parse(candidate.sentAt) >= Date.parse(latest.sentAt) ? candidate : latest, null);
  const useLatestMessage = latestMessage !== null
    && Date.parse(latestMessage.sentAt) >= Date.parse(conversation.lastMessageAt ?? "");
  const incomingCount = messages.filter((message) => message.senderId !== viewerId).length;
  return {
    ...conversation,
    lastMessageAt: useLatestMessage ? latestMessage.sentAt : conversation.lastMessageAt,
    lastMessageBody: useLatestMessage ? latestMessage.body : conversation.lastMessageBody,
    unreadCount: Math.max(conversation.unreadCount, incomingCount),
  };
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
