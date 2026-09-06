import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRealtimeClient } from "./client";

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  receive(frame: string) {
    this.onmessage?.(new MessageEvent("message", { data: frame }));
  }

  fail() {
    this.onerror?.(new Event("error"));
  }

  send(frame: string) {
    this.sent.push(frame);
  }

  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

function credential(token: string) {
  return {
    ok: true,
    json: () => Promise.resolve({
      token,
      expiresAt: "2099-09-06T13:01:30Z",
      webSocketUrl: "wss://api.example.test/ws",
    }),
  } as Response;
}

describe("RealtimeClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("scoped kimliği her bağlantı için BFF'den alıp STOMP CONNECT başlığında taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(credential("scoped-token-1"));
    vi.stubGlobal("fetch", fetchMock);
    const client = createRealtimeClient();

    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();

    expect(fetchMock).toHaveBeenCalledWith("/api/realtime-credential", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(socket.url).toBe("wss://api.example.test/ws");
    expect(socket.url).not.toContain("scoped-token-1");
    expect(socket.protocols).toBe("v12.stomp");
    expect(socket.sent).toEqual([
      "CONNECT\naccept-version:1.2\nheart-beat:0,0\nAuthorization:Bearer scoped-token-1\n\n\0",
    ]);

    socket.receive("CONNECTED\nversion:1.2\n\n\0");
    expect(client.getState()).toEqual({ phase: "live", mode: "realtime" });

    client.stop();
  });

  it("kopunca üstel geri çekilmeyle yeniden bağlanır ve her denemede yeni kimlik alır", async () => {
    vi.useFakeTimers();
    let credentialCount = 0;
    const fetchMock = vi.fn(() => Promise.resolve(credential(`scoped-token-${++credentialCount}`)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createRealtimeClient();

    client.start();
    await flushPromises();
    const first = FakeWebSocket.instances[0];
    first.open();
    first.receive("CONNECTED\nversion:1.2\n\n\0");
    first.close(1006);

    expect(client.getState()).toEqual({ phase: "reconnecting", mode: "rest", retryInMs: 1_000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    const second = FakeWebSocket.instances[1];
    second.open();
    expect(second.sent[0]).toContain("Authorization:Bearer scoped-token-2");
    second.close(1006);
    expect(client.getState()).toEqual({ phase: "reconnecting", mode: "rest", retryInMs: 2_000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    client.stop();
  });

  it("WebSocket açılış hatasında REST fallback durumuna geçip yeniden dener", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();

    client.start();
    await flushPromises();
    FakeWebSocket.instances[0].fail();

    expect(client.getState()).toEqual({ phase: "reconnecting", mode: "rest", retryInMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    await flushPromises();
    expect(FakeWebSocket.instances).toHaveLength(2);

    client.stop();
  });

  it("çevrimdışıyken denemeleri durdurup online olayında hemen yeni bağlantı açar", async () => {
    vi.useFakeTimers();
    let credentialCount = 0;
    const fetchMock = vi.fn(() => Promise.resolve(credential(`scoped-token-${++credentialCount}`)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createRealtimeClient();

    client.start();
    await flushPromises();
    const first = FakeWebSocket.instances[0];
    first.open();
    first.receive("CONNECTED\nversion:1.2\n\n\0");

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    expect(client.getState()).toEqual({ phase: "offline", mode: "rest" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await flushPromises();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    client.stop();
  });

  it("gizli sekmede beklemeyi durdurup görünür olduğunda gecikmeden yeniden dener", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(credential("scoped-token"))));
    const client = createRealtimeClient();

    client.start();
    await flushPromises();
    const first = FakeWebSocket.instances[0];
    first.open();
    first.receive("CONNECTED\nversion:1.2\n\n\0");
    first.close(1006);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(client.getState()).toEqual({ phase: "paused", mode: "rest" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(FakeWebSocket.instances).toHaveLength(2);

    client.stop();
  });

  it("konuşma REST ile başarıyla okunduktan sonra abone olur ve sayfa kapanınca aboneliği bırakır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");
    const conversationId = "386e3918-8c23-4f6d-9142-a4e04f231fc8";
    let confirmAccess = () => {};
    const accessConfirmed = new Promise<void>((resolve) => {
      confirmAccess = resolve;
    });

    const pending = client.followConversation(
      conversationId,
      () => accessConfirmed,
      vi.fn(),
    );
    await flushPromises();
    expect(socket.sent.some((frame) => frame.startsWith("SUBSCRIBE"))).toBe(false);

    confirmAccess();
    const unsubscribe = await pending;
    expect(socket.sent.at(-1)).toMatch(
      /^SUBSCRIBE\nid:realtime-1\ndestination:\/topic\/conversations\/386e3918-8c23-4f6d-9142-a4e04f231fc8\nack:auto\n\n\0$/,
    );

    unsubscribe();
    expect(socket.sent.at(-1)).toBe("UNSUBSCRIBE\nid:realtime-1\n\n\0");
    client.stop();
  });

  it("REST okuması reddedilen konuşma için SUBSCRIBE denemez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");

    await expect(client.followConversation(
      "386e3918-8c23-4f6d-9142-a4e04f231fc8",
      () => Promise.reject(new Error("not found")),
      vi.fn(),
    )).rejects.toThrow("not found");

    expect(socket.sent.some((frame) => frame.startsWith("SUBSCRIBE"))).toBe(false);
    client.stop();
  });

  it("kullanıcı mesaj kuyruğunu tek wire aboneliğiyle birden çok dinleyiciye dağıtır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const stopFirst = client.listenToMessages(firstListener);
    const stopSecond = client.listenToMessages(secondListener);
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");

    expect(socket.sent.filter((frame) => frame.startsWith("SUBSCRIBE"))).toEqual([
      "SUBSCRIBE\nid:realtime-1\ndestination:/user/queue/messages\nack:auto\n\n\0",
    ]);
    const event = {
      type: "MESSAGE",
      conversationId: "386e3918-8c23-4f6d-9142-a4e04f231fc8",
      userId: "8122deec-c0cf-4db4-8c94-d41223740c20",
      message: { id: "message-1", body: "Merhaba" },
      online: null,
      at: "2026-09-06T13:00:00Z",
      error: null,
    };
    socket.receive(stompMessage("realtime-1", "/user/queue/messages", event));

    expect(firstListener).toHaveBeenCalledWith(event);
    expect(secondListener).toHaveBeenCalledWith(event);
    stopFirst();
    expect(socket.sent.at(-1)).not.toMatch(/^UNSUBSCRIBE/);
    stopSecond();
    expect(socket.sent.at(-1)).toBe("UNSUBSCRIBE\nid:realtime-1\n\n\0");
    client.stop();
  });

  it("abonelik reddini MESSAGE type=ERROR olarak iletir ve socket'i açık tutar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    const listener = vi.fn();
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");
    const conversationId = "386e3918-8c23-4f6d-9142-a4e04f231fc8";
    await client.followConversation(conversationId, () => Promise.resolve(), listener);
    const denied = {
      type: "ERROR",
      conversationId: null,
      userId: null,
      message: null,
      online: null,
      at: "2026-09-06T13:00:00Z",
      error: {
        destination: `/topic/conversations/${conversationId}`,
        errorCode: "MESSAGING_SUBSCRIPTION_NOT_ALLOWED",
        message: "Bu aboneliğe izin verilmiyor.",
      },
    };

    socket.receive(stompMessage("realtime-1", denied.error.destination, denied));

    expect(listener).toHaveBeenCalledWith(denied);
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);
    expect(client.getState()).toEqual({ phase: "live", mode: "realtime" });
    expect(FakeWebSocket.instances).toHaveLength(1);
    client.stop();
  });

  it("yazıyor karesini yalnız erişimi doğrulanmış açık konuşma için gönderir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");
    const conversationId = "386e3918-8c23-4f6d-9142-a4e04f231fc8";

    expect(client.sendTyping(conversationId)).toBe(false);
    const unfollow = await client.followConversation(
      conversationId,
      () => Promise.resolve(),
      vi.fn(),
    );
    expect(client.sendTyping(conversationId)).toBe(true);
    expect(socket.sent.at(-1)).toBe(
      `SEND\ndestination:/app/conversations/${conversationId}/typing\n\n\0`,
    );

    unfollow();
    expect(client.sendTyping(conversationId)).toBe(false);
    client.stop();
  });

  it("presence aboneliğini de REST yetki onayından sonra açar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive("CONNECTED\nversion:1.2\n\n\0");
    const userId = "8122deec-c0cf-4db4-8c94-d41223740c20";

    const unwatch = await client.followPresence(userId, () => Promise.resolve(), vi.fn());
    expect(socket.sent.at(-1)).toBe(
      `SUBSCRIBE\nid:realtime-1\ndestination:/topic/presence/${userId}\nack:auto\n\n\0`,
    );
    unwatch();
    expect(socket.sent.at(-1)).toBe("UNSUBSCRIBE\nid:realtime-1\n\n\0");
    client.stop();
  });

  it("yeniden bağlantıda yalnız hâlâ açık yetkili abonelikleri geri kurar", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("scoped-token")));
    const client = createRealtimeClient();
    client.start();
    await flushPromises();
    const first = FakeWebSocket.instances[0];
    first.open();
    first.receive("CONNECTED\nversion:1.2\n\n\0");
    const conversationId = "386e3918-8c23-4f6d-9142-a4e04f231fc8";
    const unfollow = await client.followConversation(
      conversationId,
      () => Promise.resolve(),
      vi.fn(),
    );

    first.close(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    await flushPromises();
    const second = FakeWebSocket.instances[1];
    second.open();
    second.receive("CONNECTED\nversion:1.2\n\n\0");

    expect(second.sent.at(-1)).toBe(
      `SUBSCRIBE\nid:realtime-2\ndestination:/topic/conversations/${conversationId}\nack:auto\n\n\0`,
    );
    unfollow();
    expect(second.sent.at(-1)).toBe("UNSUBSCRIBE\nid:realtime-2\n\n\0");
    client.stop();
  });

  it("kimlik alınamazsa hata ayrıntısı yerine REST modunu bildirip yeniden dener", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("scoped-token-should-not-surface"))
      .mockResolvedValueOnce(credential("fresh-scoped-token"));
    vi.stubGlobal("fetch", fetchMock);
    const client = createRealtimeClient();

    client.start();
    await flushPromises();
    expect(client.getState()).toEqual({ phase: "reconnecting", mode: "rest", retryInMs: 1_000 });
    expect(JSON.stringify(client.getState())).not.toContain("scoped-token-should-not-surface");

    await vi.advanceTimersByTimeAsync(1_000);
    await flushPromises();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    client.stop();
  });

  it("scoped kimliği tarayıcı depolarına veya loglara yazmaz", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const logSpies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(credential("memory-only-scoped-token")));
    const client = createRealtimeClient();

    client.start();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0].open();

    expect(storageSpy).not.toHaveBeenCalled();
    logSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    client.stop();
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function stompMessage(subscriptionId: string, destination: string, body: unknown) {
  return `MESSAGE\nsubscription:${subscriptionId}\ndestination:${destination}\ncontent-type:application/json\n\n${JSON.stringify(body)}\0`;
}
