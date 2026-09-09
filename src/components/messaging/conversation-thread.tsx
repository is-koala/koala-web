"use client";

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  blockConversationUserAction,
  confirmConversationAccessAction,
  confirmPresenceAccessAction,
  loadConversationSummaryAction,
  loadOlderMessagesAction,
  markConversationReadAction,
  reportMessageAction,
  sendMessageAction,
  unblockConversationUserAction,
} from "@/app/(uygulama)/messaging-actions";
import type {
  LoadConversationSummaryResult,
  LoadMessagesResult,
  Message,
  MessageReportResult,
  MessagingActionFailure,
  MessagingMutationResult,
  Page,
  ReportReason,
  SendMessageResult,
} from "@/messaging/contract";
import { reportReasonLabels, reportReasons } from "@/messaging/contract";
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
  conversationId: string;
  conversationPage?: number;
  initialSummary: LoadConversationSummaryResult;
  initialMessages: Page<Message>;
  viewerId: string;
  basePath: string;
  realtimeClient?: RealtimeClient;
  confirmConversation?: (conversationId: string) => Promise<boolean>;
  confirmPresence?: (userId: string) => Promise<boolean>;
  sendMessage?: (conversationId: string, body: string) => Promise<SendMessageResult>;
  loadOlder?: (conversationId: string, page: number) => Promise<LoadMessagesResult>;
  loadSummary?: (
    conversationId: string,
    sourcePage: number,
  ) => Promise<LoadConversationSummaryResult>;
  markRead?: (conversationId: string) => Promise<boolean>;
  initialBlockedByViewer?: boolean;
  blockConversationUser?: (
    conversationId: string,
    sourcePage: number,
  ) => Promise<MessagingMutationResult>;
  unblockConversationUser?: (
    conversationId: string,
    sourcePage: number,
  ) => Promise<MessagingMutationResult>;
  reportMessage?: (
    conversationId: string,
    messageId: string,
    reason: string,
    description: string,
  ) => Promise<MessageReportResult>;
};

const unexpectedMutationFailure: MessagingActionFailure = {
  ok: false,
  errorCode: "UNEXPECTED",
  status: 500,
  blocked: false,
};

export function ConversationThread({
  conversationId,
  conversationPage = 0,
  initialSummary,
  initialMessages,
  viewerId,
  basePath,
  realtimeClient,
  confirmConversation = confirmConversationAccessAction,
  confirmPresence = confirmPresenceAccessAction,
  sendMessage = sendMessageAction,
  loadOlder = loadOlderMessagesAction,
  loadSummary = loadConversationSummaryAction,
  markRead = markConversationReadAction,
  initialBlockedByViewer = false,
  blockConversationUser = blockConversationUserAction,
  unblockConversationUser = unblockConversationUserAction,
  reportMessage = reportMessageAction,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [thread, setThread] = useState(() => initialThreadState(initialMessages.content));
  const [body, setBody] = useState("");
  const [blockState, setBlockState] = useState<"open" | "viewer" | "unknown">(
    initialBlockedByViewer ? "viewer" : "open",
  );
  const [safetyDialog, setSafetyDialog] = useState<"block" | "unblock" | null>(null);
  const [safetyPending, setSafetyPending] = useState(false);
  const [safetyError, setSafetyError] = useState<MessagingActionFailure | null>(null);
  const [reportDialog, setReportDialog] = useState<{ messageId: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | "">("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportFeedback, setReportFeedback] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(initialSummary.ok ? initialSummary.conversation.online : null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [connection, setConnection] = useState<RealtimeConnectionState>({ phase: "idle", mode: "rest" });
  const [olderPage, setOlderPage] = useState(initialMessages.page);
  const [hasOlder, setHasOlder] = useState(!initialMessages.last);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderLoadError, setOlderLoadError] = useState<{ errorCode: string; status: number } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = useRef(0);
  const pendingCounter = useRef(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const safetyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const initialScrollPositioned = useRef(false);
  const lastScrollTop = useRef(0);
  const pendingScrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const client = useMemo(() => realtimeClient ?? sharedRealtimeClient(), [realtimeClient]);
  const conversation = summary.ok ? summary.conversation : null;
  const summaryBlocked = !summary.ok && summary.blocked;
  const summaryPermanentlyUnavailable = !summary.ok && summary.status === 0;
  const blocked = blockState !== "open";
  const permanentlyBlocked = blocked || summaryBlocked;
  const dialogOpen = safetyDialog !== null || reportDialog !== null;
  const composerLocked = permanentlyBlocked || conversation === null || conversation.closed
    || (safetyPending && safetyDialog === "block");
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
      if (event.conversationId !== conversationId) return;
      if (event.type === "MESSAGE") {
        const message = messageFromRealtime(event.message);
        if (!message) return;
        setThread((current) => appendMessage(current, message));
        if (message.senderId !== viewerId && document.visibilityState !== "hidden") {
          void markRead(conversationId);
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
      conversationId,
      async () => {
        if (!(await confirmConversation(conversationId))) {
          throw new Error("conversation access not confirmed");
        }
      },
      receive,
      controller.signal,
    ).then((dispose) => disposers.push(dispose)).catch(() => undefined);
    if (conversation?.counterpartId) {
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
      if (document.visibilityState !== "hidden") void markRead(conversationId);
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
  }, [client, confirmConversation, confirmPresence, conversation?.counterpartId, conversationId, markRead, viewerId]);

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
    const result = await sendMessage(conversationId, trimmed);
    if (result.ok) {
      setThread((current) => reconcilePendingMessage(current, clientId, result.message));
      return;
    }
    setThread((current) => failPendingMessage(current, clientId));
    setSendError(true);
    if (result.blocked) setBlockState("unknown");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitBody(body);
  }

  function notifyTyping(nextBody: string) {
    setBody(nextBody);
    const now = Date.now();
    if (nextBody.trim() && now - lastTypingSentAt.current >= 2_000) {
      if (client.sendTyping(conversationId)) lastTypingSentAt.current = now;
    }
  }

  async function loadPrevious() {
    if (!hasOlder || loadingOlder) return;
    setLoadingOlder(true);
    setOlderLoadError(null);
    const result = await loadOlder(conversationId, olderPage + 1);
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

  async function retrySummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    try {
      const result = await loadSummary(conversationId, conversationPage);
      setSummary(result);
      if (result.ok) setOnline(result.conversation.online);
    } catch {
      // Server Action'a ulaşamamak önceki hata durumunu geçersiz kılmaz;
      // kullanıcı aynı güvenli, kilitli durumdan yeniden deneyebilir.
    } finally {
      setSummaryLoading(false);
    }
  }

  async function confirmSafetyMutation() {
    const operation = safetyDialog;
    if (operation === null || safetyPending) return;
    setSafetyPending(true);
    setSafetyError(null);
    try {
      const result = operation === "block"
        ? await blockConversationUser(conversationId, conversationPage)
        : await unblockConversationUser(conversationId, conversationPage);
      if (!result.ok) {
        setSafetyError(result);
        return;
      }
      setBlockState(operation === "block" ? "viewer" : "open");
      setSafetyDialog(null);
    } catch {
      setSafetyError(unexpectedMutationFailure);
    } finally {
      setSafetyPending(false);
    }
  }

  async function submitReport() {
    const target = reportDialog;
    const reason = reportReason;
    if (target === null || reason === "" || safetyPending) return;
    setSafetyPending(true);
    setSafetyError(null);
    try {
      const result = await reportMessage(
        conversationId,
        target.messageId,
        reason,
        reportDescription,
      );
      if (!result.ok) {
        setSafetyError(result);
        return;
      }
      setReportDialog(null);
      setReportFeedback(true);
    } catch {
      setSafetyError(unexpectedMutationFailure);
    } finally {
      setSafetyPending(false);
    }
  }

  return (
    <section className="message-thread" aria-labelledby="thread-heading">
      <header className="thread-header" inert={dialogOpen ? true : undefined}>
        <Link className="thread-back" href={basePath}>← Konuşmalar</Link>
        <div className="thread-title-row">
          <div>
            <p className="eyebrow">{conversation?.jobTitle ?? "Mesajlaşma"}</p>
            <h1 id="thread-heading">{conversation?.displayName ?? "Konuşma"}</h1>
            {conversation ? (
              <p className="thread-presence">{online === true ? "Çevrimiçi" : "Çevrimdışı"}</p>
            ) : null}
          </div>
          <div className="thread-safety-actions">
            <ConnectionStatus state={connection} />
            {conversation?.counterpartId ? (
              blockState === "unknown" ? null : (
                <button
                  className="text-link"
                  type="button"
                  onClick={(event) => {
                    safetyTriggerRef.current = event.currentTarget;
                    setSafetyError(null);
                    setSafetyDialog(blockState === "viewer" ? "unblock" : "block");
                  }}
                >
                  {blockState === "viewer" ? "Engeli kaldır" : "Kullanıcıyı engelle"}
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      {safetyDialog === "block" || safetyDialog === "unblock" ? (
        <AccessibleDialog
          labelledBy="block-user-dialog-title"
          dismissDisabled={safetyPending}
          returnFocus={safetyTriggerRef}
          onDismiss={() => setSafetyDialog(null)}
        >
          <section className="assignment-dialog">
            <h2 id="block-user-dialog-title">
              {safetyDialog === "block" ? "Kullanıcıyı engelle" : "Engeli kaldır"}
            </h2>
            <p>
              {safetyDialog === "block"
                ? "Bu konuşmada iki taraf da mesaj gönderemeyecek. İşlemi daha sonra geri alabilirsin."
                : "Engeli kaldırdığında iki taraf da bu konuşmada yeniden mesaj gönderebilir."}
            </p>
            {safetyError ? <SafetyError failure={safetyError} /> : null}
            <div className="assignment-dialog-actions">
              <button
                className="button button-secondary button-small"
                type="button"
                disabled={safetyPending}
                onClick={() => setSafetyDialog(null)}
              >
                Vazgeç
              </button>
              <button
                className="button button-primary button-small"
                type="button"
                disabled={safetyPending}
                onClick={() => void confirmSafetyMutation()}
              >
                {safetyPending
                  ? (safetyDialog === "block" ? "Engelleniyor…" : "Engel kaldırılıyor…")
                  : safetyError
                    ? "Tekrar dene"
                    : (safetyDialog === "block" ? "Engellemeyi onayla" : "Engeli kaldırmayı onayla")}
              </button>
            </div>
          </section>
        </AccessibleDialog>
      ) : null}

      {reportDialog !== null ? (
        <AccessibleDialog
          labelledBy="report-dialog-title"
          dismissDisabled={safetyPending}
          returnFocus={reportTriggerRef}
          onDismiss={() => setReportDialog(null)}
        >
          <section className="assignment-dialog">
            <h2 id="report-dialog-title">Mesajı şikâyet et</h2>
            <p>Şikâyet moderasyon ekibine iletilir; karşı tarafa açıklaman gösterilmez.</p>
            <label className="field">
              <span>Gerekçe</span>
              <select
                value={reportReason}
                disabled={safetyPending || isPermanentReportFailure(safetyError)}
                onChange={(event) => setReportReason(event.target.value as ReportReason | "")}
              >
                <option value="">Gerekçe seç</option>
                {reportReasons.map((reason) => (
                  <option key={reason} value={reason}>{reportReasonLabels[reason]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Açıklama (isteğe bağlı)</span>
              <textarea
                value={reportDescription}
                maxLength={2_000}
                rows={4}
                disabled={safetyPending || isPermanentReportFailure(safetyError)}
                onChange={(event) => setReportDescription(event.target.value)}
              />
            </label>
            {safetyError ? <SafetyError failure={safetyError} /> : null}
            <div className="assignment-dialog-actions">
              <button
                className="button button-secondary button-small"
                type="button"
                disabled={safetyPending}
                onClick={() => setReportDialog(null)}
              >
                {isPermanentReportFailure(safetyError) ? "Kapat" : "Vazgeç"}
              </button>
              {isPermanentReportFailure(safetyError) ? null : (
                <button
                  className="button button-primary button-small"
                  type="button"
                  disabled={safetyPending || reportReason === ""}
                  data-disabled-kind={reportReason === "" ? "permanent" : undefined}
                  onClick={() => void submitReport()}
                >
                  {safetyPending ? "Gönderiliyor…" : safetyError ? "Tekrar dene" : "Şikâyeti gönder"}
                </button>
              )}
            </div>
          </section>
        </AccessibleDialog>
      ) : null}

      <div
        ref={historyRef}
        className="message-history"
        inert={dialogOpen ? true : undefined}
        onScroll={handleHistoryScroll}
      >
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
          <p className="thread-empty">
            {composerLocked
              ? "Bu konuşmada henüz gösterilecek mesaj yok."
              : "İlk mesajı göndererek konuşmayı başlatabilirsin."}
          </p>
        ) : (
          <MessageGroups
            messages={thread.messages}
            viewerId={viewerId}
            canRetry={!permanentlyBlocked}
            report={(messageId, trigger) => {
              reportTriggerRef.current = trigger;
              setSafetyError(null);
              setReportReason("");
              setReportDescription("");
              setReportFeedback(false);
              setReportDialog({ messageId });
            }}
            retry={(message) => {
              if (!message.clientId) return;
              setThread((current) => removePendingMessage(current, message.clientId!));
              void submitBody(message.body);
            }}
          />
        )}
        {typing ? <p className="typing-indicator" role="status">{conversation?.displayName ?? "Karşı taraf"} yazıyor…</p> : null}
      </div>

      {summaryPermanentlyUnavailable ? (
        <div className="state-card state-card-error" role="alert">
          <h2>Konuşma bilgileri kullanılamıyor</h2>
          <p>
            Bu eski konuşmanın ayrıntıları şu anda doğrulanamıyor. Mesajları okuyabilir ve
            karşı tarafın bir mesajını şikâyet edebilirsin; engelleme ve yeni mesaj gönderme
            kullanılamıyor.
          </p>
        </div>
      ) : !summary.ok && !summary.blocked ? (
        <div className="state-card state-card-error" role="alert">
          <h2>Konuşma bilgileri yüklenemedi</h2>
          <p>{errorPresentation(summary.errorCode, summary.status).message}</p>
          <button type="button" onClick={retrySummary} disabled={summaryLoading}>
            {summaryLoading ? "Yeniden yükleniyor…" : "Tekrar dene"}
          </button>
        </div>
      ) : null}
      {permanentlyBlocked ? <p role="alert" className="composer-notice">Bu konuşmada artık mesaj gönderemezsin.</p> : null}
      {reportFeedback ? <p role="status" className="composer-notice">Şikâyetin alındı.</p> : null}
      {conversation?.closed ? <p role="status" className="composer-notice">Bu konuşma kapandı; geçmişi okumaya devam edebilirsin.</p> : null}
      {sendError && !permanentlyBlocked ? <p role="alert" className="field-error">Mesaj gönderilemedi. Tekrar deneyebilirsin.</p> : null}
      <form className="message-composer" inert={dialogOpen ? true : undefined} onSubmit={submit}>
        <label className="sr-only" htmlFor={`message-${conversationId}`}>Mesaj</label>
        <textarea
          id={`message-${conversationId}`}
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

function SafetyError({ failure }: { failure: MessagingActionFailure }) {
  const presentation = errorPresentation(failure.errorCode, failure.status);
  return (
    <div role="alert" className="field-error">
      <p>{presentation.message}</p>
      {failure.requestId ? <p>İstek kodu: {failure.requestId}</p> : null}
    </div>
  );
}

function isPermanentReportFailure(failure: MessagingActionFailure | null) {
  return failure?.errorCode === "REPORT_IDEMPOTENCY_CONFLICT" && failure.status === 409;
}

function AccessibleDialog({
  labelledBy,
  dismissDisabled,
  returnFocus,
  onDismiss,
  children,
}: {
  labelledBy: string;
  dismissDisabled: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnFocusElement = returnFocus.current;
    focusableElements(dialogRef.current)[0]?.focus();
    return () => {
      queueMicrotask(() => {
        if (returnFocusElement?.isConnected) returnFocusElement.focus();
      });
    };
  }, [returnFocus]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !dismissDisabled) {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(event.currentTarget);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      className="assignment-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) return [];
  return [...container.querySelectorAll<HTMLElement>(
    "a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )];
}

function MessageGroups({
  messages,
  viewerId,
  canRetry,
  report,
  retry,
}: {
  messages: readonly ThreadMessage[];
  viewerId: string;
  canRetry: boolean;
  report: (messageId: string, trigger: HTMLButtonElement) => void;
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
            {!mine && message.delivery === "sent" ? (
              <button
                type="button"
                aria-label={`Mesajı şikâyet et: ${messageTime(message.sentAt)} — ${messageSummary(message.body)}`}
                onClick={(event) => report(message.id, event.currentTarget)}
              >
                Mesajı şikâyet et
              </button>
            ) : null}
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

function messageSummary(body: string) {
  const summary = body.replace(/\s+/g, " ").trim().slice(0, 80);
  return summary || "İçeriksiz mesaj";
}
