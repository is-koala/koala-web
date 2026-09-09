"use client";

import Link from "next/link";
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  confirmConversationAccessAction,
  confirmPresenceAccessAction,
  loadOlderMessagesAction,
  markConversationReadAction,
  sendMessageAction,
} from "@/app/(uygulama)/messaging-actions";
import type {
  ConversationSummary,
  LoadMessagesResult,
  Message,
  Page,
  SendMessageResult,
} from "@/messaging/contract";
import { errorPresentation } from "@/lib/errors";
import { messageFromRealtime } from "@/messaging/realtime";
import {
  appendMessage,
  failPendingMessage,
  initialThreadState,
  markMessagesRead,
  prependMessages,
  reconcilePendingMessage,
  removePendingMessage,
  startPendingMessage,
  type ThreadMessage,
} from "@/messaging/thread-state";
import type { RealtimeClient, RealtimeConnectionState, RealtimeEvent } from "@/realtime/client";
import { retainRealtimeClient, sharedRealtimeClient } from "@/realtime/shared-client";

import { ConnectionStatus } from "./connection-status";

type Props = {
  conversation: ConversationSummary;
  initialMessages: Page<Message>;
  viewerId: string;
  basePath: string;
  realtimeClient?: RealtimeClient;
  confirmConversation?: (conversationId: string) => Promise<boolean>;
  confirmPresence?: (userId: string) => Promise<boolean>;
  sendMessage?: (conversationId: string, body: string) => Promise<SendMessageResult>;
  loadOlder?: (conversationId: string, page: number) => Promise<LoadMessagesResult>;
  markRead?: (conversationId: string) => Promise<boolean>;
};

export function ConversationThread({
  conversation,
  initialMessages,
  viewerId,
  basePath,
  realtimeClient,
  confirmConversation = confirmConversationAccessAction,
  confirmPresence = confirmPresenceAccessAction,
  sendMessage = sendMessageAction,
  loadOlder = loadOlderMessagesAction,
  markRead = markConversationReadAction,
}: Props) {
  const [thread, setThread] = useState(() => initialThreadState(initialMessages.content));
  const [body, setBody] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(conversation.online);
  const [connection, setConnection] = useState<RealtimeConnectionState>({ phase: "idle", mode: "rest" });
  const [olderPage, setOlderPage] = useState(initialMessages.page);
  const [hasOlder, setHasOlder] = useState(!initialMessages.last);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderLoadError, setOlderLoadError] = useState<{ errorCode: string; status: number } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = useRef(0);
  const pendingCounter = useRef(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const initialScrollPositioned = useRef(false);
  const lastScrollTop = useRef(0);
  const pendingScrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const client = useMemo(() => realtimeClient ?? sharedRealtimeClient(), [realtimeClient]);
  const composerLocked = blocked || conversation.closed;
  const sendUnavailable = composerLocked || !body.trim();

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    const anchor = pendingScrollAnchor.current;
    if (anchor) {
      history.scrollTop = anchor.top + history.scrollHeight - anchor.height;
      pendingScrollAnchor.current = null;
    } else if (!initialScrollPositioned.current) {
      history.scrollTop = history.scrollHeight;
      initialScrollPositioned.current = true;
    }
    lastScrollTop.current = history.scrollTop;
  }, [thread.messages]);

  useEffect(() => {
    const controller = new AbortController();
    const release = retainRealtimeClient(client);
    const disposers: Array<() => void> = [];
    const removeState = client.onStateChange(setConnection);
    const receive = (event: RealtimeEvent) => {
      if (event.conversationId !== conversation.id) return;
      if (event.type === "MESSAGE") {
        const message = messageFromRealtime(event.message);
        if (!message) return;
        setThread((current) => appendMessage(current, message));
        if (message.senderId !== viewerId && document.visibilityState !== "hidden") {
          void markRead(conversation.id);
        }
      }
      if (event.type === "READ" && event.userId !== viewerId) {
        setThread((current) => markMessagesRead(current, viewerId, event.at));
      }
      if (event.type === "TYPING" && event.userId !== viewerId) {
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3_500);
      }
    };
    const removePersonal = client.listenToMessages(receive);
    void client.followConversation(
      conversation.id,
      async () => {
        if (!(await confirmConversation(conversation.id))) {
          throw new Error("conversation access not confirmed");
        }
      },
      receive,
      controller.signal,
    ).then((dispose) => disposers.push(dispose)).catch(() => undefined);
    if (conversation.counterpartId) {
      const userId = conversation.counterpartId;
      void client.followPresence(
        userId,
        async () => {
          if (!(await confirmPresence(userId))) throw new Error("presence access not confirmed");
        },
        (event) => {
          if (event.type === "PRESENCE" && event.userId === userId && event.online !== null) {
            setOnline(event.online);
          }
        },
        controller.signal,
      ).then((dispose) => disposers.push(dispose)).catch(() => undefined);
    }
    const markVisible = () => {
      if (document.visibilityState !== "hidden") void markRead(conversation.id);
    };
    markVisible();
    document.addEventListener("visibilitychange", markVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", markVisible);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      disposers.forEach((dispose) => dispose());
      removePersonal();
      removeState();
      release();
    };
  }, [client, confirmConversation, confirmPresence, conversation.counterpartId, conversation.id, markRead, viewerId]);

  async function submitBody(rawBody: string) {
    const trimmed = rawBody.trim();
    if (!trimmed || composerLocked) return;
    const clientId = `${Date.now()}-${pendingCounter.current++}`;
    setBody("");
    setSendError(false);
    setThread((current) => startPendingMessage(current, {
      clientId,
      senderId: viewerId,
      body: trimmed,
      sentAt: new Date().toISOString(),
    }));
    const result = await sendMessage(conversation.id, trimmed);
    if (result.ok) {
      setThread((current) => reconcilePendingMessage(current, clientId, result.message));
      return;
    }
    setThread((current) => failPendingMessage(current, clientId));
    setSendError(true);
    if (result.blocked) setBlocked(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitBody(body);
  }

  function notifyTyping(nextBody: string) {
    setBody(nextBody);
    const now = Date.now();
    if (nextBody.trim() && now - lastTypingSentAt.current >= 2_000) {
      if (client.sendTyping(conversation.id)) lastTypingSentAt.current = now;
    }
  }

  async function loadPrevious() {
    if (!hasOlder || loadingOlder) return;
    setLoadingOlder(true);
    setOlderLoadError(null);
    const result = await loadOlder(conversation.id, olderPage + 1);
    setLoadingOlder(false);
    if (!result.ok) {
      setOlderLoadError({ errorCode: result.errorCode, status: result.status });
      return;
    }
    const history = historyRef.current;
    if (history) {
      pendingScrollAnchor.current = { height: history.scrollHeight, top: history.scrollTop };
    }
    setThread((current) => {
      const next = prependMessages(current, result.page.content);
      if (next === current) pendingScrollAnchor.current = null;
      return next;
    });
    setOlderPage(result.page.page);
    setHasOlder(!result.page.last);
  }

  function handleHistoryScroll(event: React.UIEvent<HTMLDivElement>) {
    const history = event.currentTarget;
    const movedUp = history.scrollTop < lastScrollTop.current;
    lastScrollTop.current = history.scrollTop;
    if (movedUp && history.scrollTop < 40) void loadPrevious();
  }

  return (
    <section className="message-thread" aria-labelledby="thread-heading">
      <header className="thread-header">
        <Link className="thread-back" href={basePath}>← Konuşmalar</Link>
        <div className="thread-title-row">
          <div>
            <p className="eyebrow">{conversation.jobTitle ?? "Mesajlaşma"}</p>
            <h1 id="thread-heading">{conversation.displayName}</h1>
            <p className="thread-presence">{online === true ? "Çevrimiçi" : "Çevrimdışı"}</p>
          </div>
          <ConnectionStatus state={connection} />
        </div>
      </header>

      <div ref={historyRef} className="message-history" onScroll={handleHistoryScroll}>
        {hasOlder ? (
          <button className="load-older" type="button" onClick={loadPrevious} disabled={loadingOlder}>
            {loadingOlder ? "Eski mesajlar yükleniyor…" : "Eski mesajları yükle"}
          </button>
        ) : null}
        {olderLoadError ? (
          <div className="older-load-error" role="alert">
            <p>{errorPresentation(olderLoadError.errorCode, olderLoadError.status).message}</p>
            <button type="button" onClick={loadPrevious}>Tekrar dene</button>
          </div>
        ) : null}
        {thread.messages.length === 0 ? (
          <p className="thread-empty">İlk mesajı göndererek konuşmayı başlatabilirsin.</p>
        ) : (
          <MessageGroups
            messages={thread.messages}
            viewerId={viewerId}
            canRetry={!blocked}
            retry={(message) => {
              if (!message.clientId) return;
              setThread((current) => removePendingMessage(current, message.clientId!));
              void submitBody(message.body);
            }}
          />
        )}
        {typing ? <p className="typing-indicator" role="status">{conversation.displayName} yazıyor…</p> : null}
      </div>

      {blocked ? <p role="alert" className="composer-notice">Bu konuşmada artık mesaj gönderemezsin.</p> : null}
      {conversation.closed ? <p role="status" className="composer-notice">Bu konuşma kapandı; geçmişi okumaya devam edebilirsin.</p> : null}
      {sendError && !blocked ? <p role="alert" className="field-error">Mesaj gönderilemedi. Tekrar deneyebilirsin.</p> : null}
      <form className="message-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={`message-${conversation.id}`}>Mesaj</label>
        <textarea
          id={`message-${conversation.id}`}
          name="message"
          value={body}
          onChange={(event) => notifyTyping(event.target.value)}
          placeholder="Mesajını yaz…"
          maxLength={4_000}
          rows={2}
          disabled={composerLocked}
        />
        <button
          className="button button-primary button-small"
          type="submit"
          disabled={sendUnavailable}
          data-disabled-kind={sendUnavailable ? "permanent" : undefined}
        >
          Gönder
        </button>
      </form>
    </section>
  );
}

function MessageGroups({
  messages,
  viewerId,
  canRetry,
  retry,
}: {
  messages: readonly ThreadMessage[];
  viewerId: string;
  canRetry: boolean;
  retry: (message: ThreadMessage) => void;
}) {
  let previousDay = "";
  return messages.map((message) => {
    const day = longDate(message.sentAt);
    const showDay = day !== previousDay;
    previousDay = day;
    const mine = message.senderId === viewerId;
    return (
      <div key={message.id} className="message-entry">
        {showDay ? <div className="date-separator"><span>{longDate(message.sentAt)}</span></div> : null}
        <article className={`message-bubble ${mine ? "message-mine" : "message-theirs"}`}>
          <p>{message.body}</p>
          <footer>
            <time dateTime={message.sentAt}>{messageTime(message.sentAt)}</time>
            {message.delivery === "sending" ? <span>Gönderiliyor…</span> : null}
            {message.delivery === "failed" && canRetry ? (
              <button type="button" onClick={() => retry(message)}>Tekrar dene</button>
            ) : null}
            {message.delivery === "failed" && !canRetry ? <span>Gönderilemedi</span> : null}
            {mine && message.delivery === "sent" ? <span>{message.readAt ? "Okundu" : "Gönderildi"}</span> : null}
          </footer>
        </article>
      </div>
    );
  });
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
