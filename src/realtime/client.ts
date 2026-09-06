import { realtimeEventOf, type RealtimeEvent } from "./event-decoder";
import { framesOf, stompFrame, type StompFrame } from "./stomp-codec";

export type { RealtimeEvent } from "./event-decoder";

export type RealtimeConnectionState =
  | { phase: "idle"; mode: "rest" }
  | { phase: "connecting"; mode: "rest" }
  | { phase: "reconnecting"; mode: "rest"; retryInMs: number }
  | { phase: "offline"; mode: "rest" }
  | { phase: "paused"; mode: "rest" }
  | { phase: "live"; mode: "realtime" };

export type RealtimeStateListener = (state: RealtimeConnectionState) => void;

export type RealtimeEventListener = (event: RealtimeEvent) => void;

export type RealtimeClient = {
  start(): void;
  stop(): void;
  getState(): RealtimeConnectionState;
  onStateChange(listener: RealtimeStateListener): () => void;
  listenToMessages(listener: RealtimeEventListener): () => void;
  followConversation(
    conversationId: string,
    confirmAccess: () => Promise<unknown>,
    listener: RealtimeEventListener,
    signal?: AbortSignal,
  ): Promise<() => void>;
  followPresence(
    userId: string,
    confirmAccess: () => Promise<unknown>,
    listener: RealtimeEventListener,
    signal?: AbortSignal,
  ): Promise<() => void>;
  sendTyping(conversationId: string): boolean;
};

type RealtimeBootstrap = {
  token: string;
  expiresAt: string;
  webSocketUrl: string;
};

const credentialEndpoint = "/api/realtime-credential";
const credentialRenewalMarginMs = 10_000;
const handshakeTimeoutMs = 10_000;
const maximumTimerDelayMs = 2_147_000_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DesiredSubscription = {
  listeners: Set<RealtimeEventListener>;
  subscriptionId: string | null;
};

/**
 * Kimlik yenileme, socket yaşam döngüsü ve REST fallback durumunu tek küçük
 * interface arkasında tutan tarayıcı transport modülü.
 */
export function createRealtimeClient(): RealtimeClient {
  let state: RealtimeConnectionState = { phase: "idle", mode: "rest" };
  let started = false;
  let generation = 0;
  let socket: WebSocket | null = null;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let credentialRenewalTimer: ReturnType<typeof setTimeout> | null = null;
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  let nextSubscriptionId = 1;
  const listeners = new Set<RealtimeStateListener>();
  const desiredSubscriptions = new Map<string, DesiredSubscription>();

  function publish(next: RealtimeConnectionState) {
    state = next;
    listeners.forEach((listener) => listener(next));
  }

  async function connect(currentGeneration: number) {
    publish({ phase: "connecting", mode: "rest" });
    try {
      const bootstrap = await fetchBootstrap();
      if (!started || currentGeneration !== generation) return;

      const nextSocket = new WebSocket(bootstrap.webSocketUrl, "v12.stomp");
      socket = nextSocket;
      nextSocket.onopen = () => {
        if (!started || socket !== nextSocket) return;
        nextSocket.send(stompFrame("CONNECT", [
          ["accept-version", "1.2"],
          ["heart-beat", "0,0"],
          ["Authorization", `Bearer ${bootstrap.token}`],
        ]));
        bootstrap.token = "";
        handshakeTimer = setTimeout(() => {
          handshakeTimer = null;
          if (started && socket === nextSocket && state.phase !== "live") {
            nextSocket.close(1002, "STOMP handshake timeout");
          }
        }, handshakeTimeoutMs);
      };
      nextSocket.onmessage = (event) => {
        if (!started || socket !== nextSocket) return;
        if (typeof event.data !== "string") return;
        framesOf(event.data).forEach((frame) => receiveFrame(
          frame,
          nextSocket,
          bootstrap.expiresAt,
        ));
      };
      nextSocket.onerror = () => {
        if (!started || socket !== nextSocket) return;
        nextSocket.close();
      };
      nextSocket.onclose = () => {
        if (socket !== nextSocket) return;
        cancelConnectionTimers();
        socket = null;
        resetActiveSubscriptions();
        scheduleReconnect();
      };
    } catch {
      if (started && currentGeneration === generation) scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (!started) return;
    if (!navigator.onLine) {
      publish({ phase: "offline", mode: "rest" });
      return;
    }
    if (document.visibilityState === "hidden") {
      publish({ phase: "paused", mode: "rest" });
      return;
    }

    const retryInMs = Math.min(1_000 * 2 ** retryAttempt, 30_000);
    retryAttempt += 1;
    generation += 1;
    const retryGeneration = generation;
    publish({ phase: "reconnecting", mode: "rest", retryInMs });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect(retryGeneration);
    }, retryInMs);
  }

  function cancelRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function cancelConnectionTimers() {
    if (credentialRenewalTimer) clearTimeout(credentialRenewalTimer);
    if (handshakeTimer) clearTimeout(handshakeTimer);
    credentialRenewalTimer = null;
    handshakeTimer = null;
  }

  function closeSocket(sendDisconnect: boolean) {
    const current = socket;
    socket = null;
    cancelConnectionTimers();
    resetActiveSubscriptions();
    if (!current) return;
    if (sendDisconnect && current.readyState === WebSocket.OPEN) {
      current.send(stompFrame("DISCONNECT"));
    }
    current.onopen = null;
    current.onmessage = null;
    current.onclose = null;
    current.onerror = null;
    current.close();
  }

  function resetActiveSubscriptions() {
    desiredSubscriptions.forEach((subscription) => {
      subscription.subscriptionId = null;
    });
  }

  function scheduleCredentialRenewal(currentSocket: WebSocket, expiresAt: string) {
    const delay = Math.max(0, Math.min(
      Date.parse(expiresAt) - Date.now() - credentialRenewalMarginMs,
      maximumTimerDelayMs,
    ));
    credentialRenewalTimer = setTimeout(() => {
      credentialRenewalTimer = null;
      if (!started || socket !== currentSocket) return;
      generation += 1;
      closeSocket(false);
      if (!navigator.onLine) {
        publish({ phase: "offline", mode: "rest" });
      } else if (document.visibilityState === "hidden") {
        publish({ phase: "paused", mode: "rest" });
      } else {
        void connect(generation);
      }
    }, delay);
  }

  function handleOffline() {
    if (!started) return;
    generation += 1;
    cancelRetry();
    closeSocket(false);
    publish({ phase: "offline", mode: "rest" });
  }

  function handleOnline() {
    if (!started || socket || state.phase === "connecting" || document.visibilityState === "hidden") {
      return;
    }
    retryAttempt = 0;
    generation += 1;
    void connect(generation);
  }

  function handleVisibilityChange() {
    if (!started || socket) return;
    if (document.visibilityState === "hidden") {
      generation += 1;
      cancelRetry();
      publish({ phase: "paused", mode: "rest" });
      return;
    }
    if (navigator.onLine) handleOnline();
  }

  function addSubscription(destination: string, listener: RealtimeEventListener) {
    let subscription = desiredSubscriptions.get(destination);
    if (!subscription) {
      subscription = { listeners: new Set(), subscriptionId: null };
      desiredSubscriptions.set(destination, subscription);
    }
    subscription.listeners.add(listener);
    activateSubscription(destination, subscription);

    return () => {
      const current = desiredSubscriptions.get(destination);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;
      desiredSubscriptions.delete(destination);
      if (current.subscriptionId && socket?.readyState === WebSocket.OPEN) {
        socket.send(stompFrame("UNSUBSCRIBE", [["id", current.subscriptionId]]));
      }
    };
  }

  function receiveFrame(frame: StompFrame, currentSocket: WebSocket, credentialExpiresAt: string) {
    if (frame.command === "CONNECTED") {
      if (handshakeTimer) clearTimeout(handshakeTimer);
      handshakeTimer = null;
      retryAttempt = 0;
      publish({ phase: "live", mode: "realtime" });
      scheduleCredentialRenewal(currentSocket, credentialExpiresAt);
      desiredSubscriptions.forEach((subscription, destination) => {
        activateSubscription(destination, subscription);
      });
      return;
    }

    if (frame.command === "ERROR") {
      currentSocket.close(1002, "STOMP error");
      return;
    }

    if (frame.command !== "MESSAGE") return;
    const subscriptionId = frame.headers.get("subscription");
    if (!subscriptionId) return;
    const entry = [...desiredSubscriptions.entries()].find(
      ([, subscription]) => subscription.subscriptionId === subscriptionId,
    );
    if (!entry) return;

    const event = realtimeEventOf(frame.body);
    if (!event) return;
    const [destination, subscription] = entry;
    [...subscription.listeners].forEach((listener) => listener(event));

    // Backend abonelik reddini bağlantıyı kapatmayan MESSAGE/ERROR olarak
    // yollar. Aynı yetkisiz hedefi her reconnect'te yeniden denemeyiz.
    if (event.type === "ERROR") {
      desiredSubscriptions.delete(destination);
      subscription.subscriptionId = null;
    }
  }

  function activateSubscription(destination: string, subscription: DesiredSubscription) {
    if (state.phase !== "live" || socket?.readyState !== WebSocket.OPEN ||
        subscription.subscriptionId) {
      return;
    }
    const subscriptionId = `realtime-${nextSubscriptionId++}`;
    subscription.subscriptionId = subscriptionId;
    socket.send(stompFrame("SUBSCRIBE", [
      ["id", subscriptionId],
      ["destination", destination],
      ["ack", "auto"],
    ]));
  }

  return {
    start() {
      if (started) return;
      started = true;
      retryAttempt = 0;
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      if (!navigator.onLine) {
        publish({ phase: "offline", mode: "rest" });
        return;
      }
      generation += 1;
      void connect(generation);
    },
    stop() {
      if (!started) return;
      started = false;
      generation += 1;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelRetry();
      closeSocket(true);
      publish({ phase: "idle", mode: "rest" });
    },
    getState() {
      return state;
    },
    onStateChange(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    listenToMessages(listener) {
      return addSubscription("/user/queue/messages", listener);
    },
    async followConversation(conversationId, confirmAccess, listener, signal) {
      if (!uuidPattern.test(conversationId)) {
        throw new Error("Konuşma kimliği geçerli değil.");
      }
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      // REST okuması yetki kanıtıdır. Reddedilirse wire seviyesinde hiçbir
      // SUBSCRIBE üretilmez ve backend'in bağlantıyı koruyan hata yolu bile
      // gereksiz yere çalıştırılmaz.
      await confirmAccess();
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return addSubscription(`/topic/conversations/${conversationId}`, listener);
    },
    async followPresence(userId, confirmAccess, listener, signal) {
      if (!uuidPattern.test(userId)) throw new Error("Kullanıcı kimliği geçerli değil.");
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await confirmAccess();
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return addSubscription(`/topic/presence/${userId}`, listener);
    },
    sendTyping(conversationId) {
      if (!uuidPattern.test(conversationId) || state.phase !== "live" ||
          socket?.readyState !== WebSocket.OPEN) {
        return false;
      }
      const conversationDestination = `/topic/conversations/${conversationId}`;
      if (!desiredSubscriptions.get(conversationDestination)?.subscriptionId) return false;

      socket.send(stompFrame("SEND", [
        ["destination", `/app/conversations/${conversationId}/typing`],
      ]));
      return true;
    },
  };
}

async function fetchBootstrap(): Promise<RealtimeBootstrap> {
  const response = await fetch(credentialEndpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("realtime unavailable");

  const value: unknown = await response.json();
  if (!isBootstrap(value)) throw new Error("realtime unavailable");
  return value;
}

function isBootstrap(value: unknown): value is RealtimeBootstrap {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RealtimeBootstrap>;
  if (typeof candidate.token !== "string" || !candidate.token) return false;
  if (typeof candidate.expiresAt !== "string" || Date.parse(candidate.expiresAt) <= Date.now()) {
    return false;
  }
  if (typeof candidate.webSocketUrl !== "string") return false;

  try {
    const url = new URL(candidate.webSocketUrl);
    return (url.protocol === "ws:" || url.protocol === "wss:") &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}
