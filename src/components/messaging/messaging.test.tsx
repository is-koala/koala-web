import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationSummary, Message, Page } from "@/messaging/contract";
import type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeEvent,
  RealtimeEventListener,
} from "@/realtime/client";

import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const conversationId = "33333333-3333-4333-8333-333333333333";

afterEach(() => vi.restoreAllMocks());

describe("mesajlaşma arayüzü", () => {
  it("listeyi tek kişisel kuyrukla günceller ve konuşma topic'lerine abone olmaz", async () => {
    const realtime = new FakeRealtime();
    const confirmPresence = vi.fn().mockResolvedValue(true);
    render(
      <ConversationList
        initialPage={conversationPage()}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmPresence={confirmPresence}
      />,
    );

    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    expect(realtime.followedConversations).toEqual([]);
    expect(realtime.followedPresence).toEqual([otherId]);
    expect(confirmPresence).toHaveBeenCalledWith(otherId);

    act(() => realtime.emitPersonal(event("MESSAGE", message("Yeni mesaj", otherId))));

    const link = screen.getByRole("link", { name: /Ece Yılmaz/ });
    expect(within(link).getByText("Yeni mesaj")).toBeVisible();
    expect(within(link).getByLabelText("3 okunmamış mesaj")).toBeVisible();
  });

  it("kişisel kuyrukta yüklü olmayan konuşma gelince ilk sayfayı yenileyip konuşmayı üste taşır", async () => {
    const realtime = new FakeRealtime();
    const newConversationId = "55555555-5555-4555-8555-555555555555";
    const newConversation: ConversationSummary = {
      ...conversationPage().content[0]!,
      id: newConversationId,
      displayName: "Bora Kaya",
      lastMessageAt: "2026-09-06T09:00:00Z",
      lastMessageBody: "Eski özet",
      unreadCount: 0,
    };
    const loadPage = vi.fn().mockResolvedValue({
      ok: true,
      page: {
        ...conversationPage(),
        content: [newConversation, ...conversationPage().content],
        totalElements: 2,
      },
    });
    render(
      <ConversationList
        initialPage={conversationPage()}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadPage={loadPage}
      />,
    );

    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    const incoming = { ...message("Yeni konuşma", otherId), sentAt: "2026-09-06T12:00:00Z" };
    act(() => realtime.emitPersonal({
      ...event("MESSAGE", incoming),
      conversationId: newConversationId,
    }));

    await waitFor(() => expect(loadPage).toHaveBeenCalledWith(0));
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(within(links[0]!).getByText("Bora Kaya")).toBeVisible();
    expect(within(links[0]!).getByText("Yeni konuşma")).toBeVisible();
    expect(within(links[0]!).getByLabelText("1 okunmamış mesaj")).toBeVisible();
  });

  it("bilinmeyen konuşmanın yenileme sırasında gelen tüm mesajlarını kaybetmeden birleştirir", async () => {
    const realtime = new FakeRealtime();
    const newConversationId = "55555555-5555-4555-8555-555555555555";
    const newConversation: ConversationSummary = {
      ...conversationPage().content[0]!,
      id: newConversationId,
      displayName: "Bora Kaya",
      lastMessageAt: "2026-09-06T09:00:00Z",
      lastMessageBody: "Eski özet",
      unreadCount: 0,
    };
    let resolvePage!: (result: {
      ok: true;
      page: Page<ConversationSummary>;
    }) => void;
    const loadPage = vi.fn(() => new Promise<{
      ok: true;
      page: Page<ConversationSummary>;
    }>((resolve) => { resolvePage = resolve; }));
    render(
      <ConversationList
        initialPage={conversationPage()}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadPage={loadPage}
      />,
    );

    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    act(() => {
      realtime.emitPersonal({
        ...event("MESSAGE", {
          ...message("İlk hızlı mesaj", otherId),
          id: "66666666-6666-4666-8666-666666666666",
          sentAt: "2026-09-06T12:00:00Z",
        }),
        conversationId: newConversationId,
      });
      realtime.emitPersonal({
        ...event("MESSAGE", {
          ...message("İkinci hızlı mesaj", otherId),
          id: "77777777-7777-4777-8777-777777777777",
          sentAt: "2026-09-06T12:01:00Z",
        }),
        conversationId: newConversationId,
      });
    });

    await act(async () => resolvePage({
      ok: true,
      page: {
        ...conversationPage(),
        content: [newConversation, ...conversationPage().content],
        totalElements: 2,
      },
    }));

    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(within(links[0]!).getByText("İkinci hızlı mesaj")).toBeVisible();
    expect(within(links[0]!).getByLabelText("2 okunmamış mesaj")).toBeVisible();
  });

  it("ilk REST görüntüsü transaction yarışında konuşmayı içermiyorsa yeniden okur", async () => {
    const realtime = new FakeRealtime();
    const newConversationId = "55555555-5555-4555-8555-555555555555";
    const newConversation: ConversationSummary = {
      ...conversationPage().content[0]!,
      id: newConversationId,
      displayName: "Bora Kaya",
      lastMessageAt: "2026-09-06T09:00:00Z",
      lastMessageBody: "Eski özet",
      unreadCount: 0,
    };
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ ok: true, page: conversationPage() })
      .mockResolvedValueOnce({
        ok: true,
        page: {
          ...conversationPage(),
          content: [newConversation, ...conversationPage().content],
          totalElements: 2,
        },
      });
    render(
      <ConversationList
        initialPage={conversationPage()}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadPage={loadPage}
      />,
    );

    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    act(() => realtime.emitPersonal({
      ...event("MESSAGE", {
        ...message("Commit sonrası görünür", otherId),
        sentAt: "2026-09-06T12:00:00Z",
      }),
      conversationId: newConversationId,
    }));

    await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Commit sonrası görünür")).toBeVisible();
  });

  it("REST doğrulaması tamamlanmadan konuşma topic'ine abone olmaz ve kopyayı tekilleştirir", async () => {
    const realtime = new FakeRealtime();
    let allowAccess!: () => void;
    const access = new Promise<boolean>((resolve) => { allowAccess = () => resolve(true); });
    const confirmConversation = vi.fn(() => access);
    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={confirmConversation}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await waitFor(() => expect(confirmConversation).toHaveBeenCalledWith(conversationId));
    expect(realtime.activeConversationListeners).toHaveLength(0);
    allowAccess();
    await waitFor(() => expect(realtime.activeConversationListeners).toHaveLength(1));

    const saved = message("Tek kopya", otherId);
    act(() => {
      realtime.emitConversation(event("MESSAGE", saved));
      realtime.emitPersonal(event("MESSAGE", saved));
    });
    expect(screen.getAllByText("Tek kopya")).toHaveLength(1);
  });

  it("ilk açılışta en alta gider; yukarı kaydırınca eski sayfayı ekleyip viewport'u korur", async () => {
    const realtime = new FakeRealtime();
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
      return this.querySelectorAll(".message-entry").length > 1 ? 1_200 : 900;
    });
    const latest = message("Yeni mesaj", otherId);
    const older = {
      ...message("Eski mesaj", otherId),
      id: "66666666-6666-4666-8666-666666666666",
      sentAt: "2026-09-06T10:00:00Z",
    };
    const loadOlder = vi.fn().mockResolvedValue({
      ok: true,
      page: { ...messagePage([older]), page: 1 },
    });

    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={{ ...messagePage([latest]), last: false, totalPages: 2 }}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadOlder={loadOlder}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    const history = document.querySelector<HTMLElement>(".message-history")!;
    expect(history.scrollTop).toBe(900);

    history.scrollTop = 300;
    fireEvent.scroll(history);
    expect(loadOlder).not.toHaveBeenCalled();

    history.scrollTop = 10;
    fireEvent.scroll(history);
    await screen.findByText("Eski mesaj");

    expect(loadOlder).toHaveBeenCalledWith(conversationId, 1);
    expect(history.scrollTop).toBe(310);
  });

  it("eski mesaj yükleme hatasını koddan Türkçeleştirir ve aynı sayfayı yeniden denetir", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    const older = {
      ...message("Eski mesaj", otherId),
      id: "77777777-7777-4777-8777-777777777777",
      sentAt: "2026-09-06T10:00:00Z",
    };
    const loadOlder = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        errorCode: "TOO_MANY_REQUESTS",
        status: 429,
        blocked: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        page: { ...messagePage([older]), page: 1 },
      });

    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={{ ...messagePage([message("Yeni mesaj", otherId)]), last: false, totalPages: 2 }}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadOlder={loadOlder}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Eski mesajları yükle" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Kısa bir süre bekleyip yeniden dene.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByText("Eski mesaj")).toBeVisible();
    expect(loadOlder).toHaveBeenNthCalledWith(2, conversationId, 1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mesajı iyimser gösterir ve REST sonucu geldiğinde tek kayıtla uzlaştırır", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    let settle!: (value: { ok: true; message: Message }) => void;
    const send = vi.fn(() => new Promise<{ ok: true; message: Message }>((resolve) => {
      settle = resolve;
    }));
    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        sendMessage={send}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Mesaj" }), "Geliyorum");
    await user.click(screen.getByRole("button", { name: "Gönder" }));
    expect(screen.getByText("Gönderiliyor…")).toBeVisible();

    const saved = message("Geliyorum", viewerId);
    act(() => settle({ ok: true, message: saved }));
    await waitFor(() => expect(screen.queryByText("Gönderiliyor…")).toBeNull());
    expect(screen.getAllByText("Geliyorum")).toHaveLength(1);
  });

  it("topic REST yanıtından önce gelirse iyimser satırı anında sunucu mesajıyla uzlaştırır", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    let settle!: (value: { ok: true; message: Message }) => void;
    const send = vi.fn(() => new Promise<{ ok: true; message: Message }>((resolve) => {
      settle = resolve;
    }));
    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        sendMessage={send}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    await user.type(screen.getByRole("textbox", { name: "Mesaj" }), "Aynı anda");
    await user.click(screen.getByRole("button", { name: "Gönder" }));
    expect(screen.getByText("Gönderiliyor…")).toBeVisible();

    const saved = message("Aynı anda", viewerId);
    act(() => realtime.emitPersonal(event("MESSAGE", saved)));

    expect(screen.getAllByText("Aynı anda")).toHaveLength(1);
    expect(screen.queryByText("Gönderiliyor…")).toBeNull();

    act(() => settle({ ok: true, message: saved }));
    await waitFor(() => expect(screen.getAllByText("Aynı anda")).toHaveLength(1));
  });

  it("engelleme 403'ünde açıklama gösterir ve gönderme alanını kilitler", async () => {
    const realtime = new FakeRealtime();
    render(
      <ConversationThread
        conversation={conversationPage().content[0]!}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        sendMessage={vi.fn().mockResolvedValue({
          ok: false,
          errorCode: "USER_BLOCKED",
          status: 403,
          blocked: true,
        })}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Mesaj" }), {
      target: { value: "Merhaba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gönder" }));

    await screen.findByText("Bu konuşmada artık mesaj gönderemezsin.");
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
  });
});

class FakeRealtime implements RealtimeClient {
  personalListeners: RealtimeEventListener[] = [];
  activeConversationListeners: RealtimeEventListener[] = [];
  followedConversations: string[] = [];
  followedPresence: string[] = [];
  state: RealtimeConnectionState = { phase: "live", mode: "realtime" };
  start = vi.fn();
  stop = vi.fn();
  getState = () => this.state;
  onStateChange(listener: (state: RealtimeConnectionState) => void) {
    listener(this.state);
    return () => undefined;
  }
  listenToMessages(listener: RealtimeEventListener) {
    this.personalListeners.push(listener);
    return () => { this.personalListeners = this.personalListeners.filter((item) => item !== listener); };
  }
  async followConversation(
    id: string,
    confirm: () => Promise<unknown>,
    listener: RealtimeEventListener,
  ) {
    this.followedConversations.push(id);
    await confirm();
    this.activeConversationListeners.push(listener);
    return () => {
      this.activeConversationListeners = this.activeConversationListeners.filter(
        (item) => item !== listener,
      );
    };
  }
  async followPresence(
    id: string,
    confirm: () => Promise<unknown>,
    listener: RealtimeEventListener,
  ) {
    void listener;
    this.followedPresence.push(id);
    await confirm();
    return () => undefined;
  }
  sendTyping = vi.fn(() => true);
  emitPersonal(value: RealtimeEvent) {
    this.personalListeners.forEach((listener) => listener(value));
  }
  emitConversation(value: RealtimeEvent) {
    this.activeConversationListeners.forEach((listener) => listener(value));
  }
}

function conversationPage(): Page<ConversationSummary> {
  return {
    content: [{
      id: conversationId,
      jobId: null,
      jobTitle: "Akşam vardiyası",
      displayName: "Ece Yılmaz",
      profilePictureUrl: null,
      counterpartId: otherId,
      lastMessageAt: "2026-09-06T10:00:00Z",
      lastMessageBody: "Önceki mesaj",
      unreadCount: 2,
      closed: false,
      online: true,
    }],
    page: 0,
    totalPages: 1,
    totalElements: 1,
    last: true,
  };
}

function messagePage(content: Message[]): Page<Message> {
  return { content, page: 0, totalPages: 1, totalElements: content.length, last: true };
}

function message(body: string, senderId: string): Message {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    senderId,
    body,
    sentAt: "2026-09-06T11:00:00Z",
    readAt: null,
  };
}

function event(type: RealtimeEvent["type"], value: Message): RealtimeEvent {
  return {
    type,
    conversationId,
    userId: value.senderId,
    message: value,
    online: null,
    at: value.sentAt,
    error: null,
  };
}
