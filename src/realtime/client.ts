export type RealtimeConnectionState =
  | { phase: "idle"; mode: "rest" }
  | { phase: "connecting"; mode: "rest" }
  | { phase: "reconnecting"; mode: "rest"; retryInMs: number }
  | { phase: "offline"; mode: "rest" }
  | { phase: "paused"; mode: "rest" }
  | { phase: "live"; mode: "realtime" };

export type RealtimeStateListener = (state: RealtimeConnectionState) => void;

export type RealtimeEvent = {
  type: "MESSAGE" | "TYPING" | "READ" | "PRESENCE" | "ERROR";
  conversationId: string | null;
  userId: string | null;
  message: unknown;
  online: boolean | null;
  at: string;
  error: { destination: string; errorCode: string; message: string } | null;
};

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
  ): Promise<() => void>;
  followPresence(
    userId: string,
    confirmAccess: () => Promise<unknown>,
    listener: RealtimeEventListener,
  ): Promise<() => void>;
  sendTyping(conversationId: string): boolean;
};

type RealtimeBootstrap = {
  token: string;
  expiresAt: string;
  webSocketUrl: string;
};

const credentialEndpoint = "/api/realtime-credential";
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
      };
      nextSocket.onmessage = (event) => {
        if (!started || socket !== nextSocket) return;
        if (typeof event.data !== "string") return;
        framesOf(event.data).forEach((frame) => receiveFrame(frame, nextSocket));
      };
      nextSocket.onerror = () => {
        if (!started || socket !== nextSocket) return;
        nextSocket.close();
      };
      nextSocket.onclose = () => {
        if (socket !== nextSocket) return;
        socket = null;
        desiredSubscriptions.forEach((subscription) => {
          subscription.subscriptionId = null;
        });
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

  function closeSocket(sendDisconnect: boolean) {
    const current = socket;
    socket = null;
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

  function receiveFrame(frame: StompFrame, currentSocket: WebSocket) {
    if (frame.command === "CONNECTED") {
      retryAttempt = 0;
      publish({ phase: "live", mode: "realtime" });
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
    async followConversation(conversationId, confirmAccess, listener) {
      if (!uuidPattern.test(conversationId)) {
        throw new Error("Konuşma kimliği geçerli değil.");
      }
      // REST okuması yetki kanıtıdır. Reddedilirse wire seviyesinde hiçbir
      // SUBSCRIBE üretilmez ve backend'in bağlantıyı koruyan hata yolu bile
      // gereksiz yere çalıştırılmaz.
      await confirmAccess();
      return addSubscription(`/topic/conversations/${conversationId}`, listener);
    },
    async followPresence(userId, confirmAccess, listener) {
      if (!uuidPattern.test(userId)) throw new Error("Kullanıcı kimliği geçerli değil.");
      await confirmAccess();
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

function stompFrame(command: string, headers: readonly (readonly [string, string])[] = []) {
  const lines = [command, ...headers.map(([name, value]) => `${name}:${escapeHeader(value)}`)];
  return `${lines.join("\n")}\n\n\0`;
}

function escapeHeader(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n").replaceAll(":", "\\c");
}

type StompFrame = {
  command: string;
  headers: Map<string, string>;
  body: string;
};

function framesOf(payload: string): StompFrame[] {
  return payload
    .replaceAll("\r\n", "\n")
    .split("\0")
    .map((value) => value.replace(/^\n+/, ""))
    .filter((value) => value.length > 0)
    .map(parseFrame)
    .filter((frame): frame is StompFrame => frame !== null);
}

function parseFrame(raw: string): StompFrame | null {
  const separator = raw.indexOf("\n\n");
  const head = separator >= 0 ? raw.slice(0, separator) : raw;
  const body = separator >= 0 ? raw.slice(separator + 2) : "";
  const [command, ...headerLines] = head.split("\n");
  if (!command) return null;

  const headers = new Map<string, string>();
  headerLines.forEach((line) => {
    const colon = line.indexOf(":");
    if (colon <= 0) return;
    headers.set(line.slice(0, colon), unescapeHeader(line.slice(colon + 1)));
  });
  return { command, headers, body };
}

function unescapeHeader(value: string) {
  return value.replace(/\\([crn\\])/g, (_, escaped: string) => {
    if (escaped === "c") return ":";
    if (escaped === "r") return "\r";
    if (escaped === "n") return "\n";
    return "\\";
  });
}

const eventTypes = new Set<RealtimeEvent["type"]>([
  "MESSAGE", "TYPING", "READ", "PRESENCE", "ERROR",
]);

function realtimeEventOf(body: string): RealtimeEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<RealtimeEvent>;
  if (typeof candidate.type !== "string" ||
      !eventTypes.has(candidate.type as RealtimeEvent["type"])) {
    return null;
  }
  if (typeof candidate.at !== "string") return null;
  if (!(candidate.conversationId === null || typeof candidate.conversationId === "string")) {
    return null;
  }
  if (!(candidate.userId === null || typeof candidate.userId === "string")) return null;
  if (!(candidate.online === null || typeof candidate.online === "boolean")) return null;
  if (!(candidate.error === null || isRealtimeError(candidate.error))) return null;
  return candidate as RealtimeEvent;
}

function isRealtimeError(value: unknown): value is NonNullable<RealtimeEvent["error"]> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NonNullable<RealtimeEvent["error"]>>;
  return typeof candidate.destination === "string" &&
    typeof candidate.errorCode === "string" && typeof candidate.message === "string";
}
