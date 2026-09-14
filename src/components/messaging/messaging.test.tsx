import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ConversationSummary,
  Message,
  MessagingMutationResult,
  Page,
} from "@/messaging/contract";
import { errorPresentation } from "@/lib/errors";
import { participant } from "../../../tests/support/messaging";
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
  it("özet okunamazken geçmişi gösterir, hatayı ayrı sunar ve gönderimi kilitler", async () => {
    const realtime = new FakeRealtime();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
        initialMessages={messagePage([message("Geçmişteki mesaj", otherId)])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText("Geçmişteki mesaj")).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Konuşma bilgileri yüklenemedi" }))
      .toBeVisible();
    expect(within(alert).getByRole("button", { name: "Tekrar dene" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gönder" }))
      .toHaveAttribute("data-disabled-kind", "permanent");
  });

  it("ilk özet isteği 403 olduğunda yeniden deneme yerine kalıcı engeli gösterir", () => {
    render(
      <ConversationThreadForSummary
        initialSummary={{
          ok: false,
          errorCode: "MESSAGING_BLOCKED",
          status: 403,
          blocked: true,
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bu konuşmada artık mesaj gönderemezsin.",
    );
    expect(screen.queryByText("Konuşma bilgileri yüklenemedi")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
  });

  it("özet retry'ı 403 dönerse sonucu kalıcı engel olarak saklar", async () => {
    const user = userEvent.setup();
    render(
      <ConversationThreadForSummary
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
        loadSummary={vi.fn().mockResolvedValue({
          ok: false,
          errorCode: "MESSAGING_BLOCKED",
          status: 403,
          blocked: true,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bu konuşmada artık mesaj gönderemezsin.",
    );
    expect(screen.queryByText("Konuşma bilgileri yüklenemedi")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).toBeNull();
  });

  it("özet retry taşıma hatasında hata panelini yeniden denenebilir bırakır", async () => {
    const user = userEvent.setup();
    const loadSummary = vi.fn().mockRejectedValue(new Error("transport failed"));
    render(
      <ConversationThreadForSummary
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
        loadSummary={loadSummary}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("button", { name: "Tekrar dene" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Konuşma bilgileri yüklenemedi");
    expect(loadSummary).toHaveBeenCalledTimes(1);
  });

  it("özet bilinmiyorken boş geçmişi mesaj göndermeye çağırmadan nötr anlatır", () => {
    render(
      <ConversationThreadForSummary
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
      />,
    );

    expect(screen.getByText("Bu konuşmada henüz gösterilecek mesaj yok.")).toBeVisible();
    expect(screen.queryByText("İlk mesajı göndererek konuşmayı başlatabilirsin.")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
  });

  it("ilk sayfada bulunmayan eski konuşmayı sonuçsuz retry yerine sınırlı güvenli modda gösterir", () => {
    const loadSummary = vi.fn();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{
          ok: false,
          errorCode: "UNEXPECTED",
          status: 0,
          blocked: false,
        }}
        initialMessages={messagePage([message("Geçmişteki karşı taraf mesajı", otherId)])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        loadSummary={loadSummary}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bu eski konuşmanın ayrıntıları şu anda doğrulanamıyor",
    );
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Kullanıcıyı engelle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kullanıcıyı şikâyet et" })).toBeNull();
    expect(loadSummary).not.toHaveBeenCalled();
  });

  it("özet yeniden okununca gerçek kapalı durumu uygular", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    const closedConversation = { ...conversationPage().content[0]!, closed: true };
    const loadSummary = vi.fn().mockResolvedValue({
      ok: true,
      conversation: closedConversation,
    });
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
        initialMessages={messagePage([message("Geçmişteki mesaj", otherId)])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadSummary={loadSummary}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByText("Bu konuşma kapandı; geçmişi okumaya devam edebilirsin."))
      .toBeVisible();
    expect(loadSummary).toHaveBeenCalledWith(conversationId, 0);
    expect(screen.queryByText("Konuşma bilgileri yüklenemedi")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
  });

  it("composer'ı yalnız yenilenen özet konuşmanın açık olduğunu doğrulayınca açar", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{
          ok: false,
          errorCode: "SERVICE_UNAVAILABLE",
          status: 503,
          blocked: false,
        }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        loadSummary={vi.fn().mockResolvedValue({
          ok: true,
          conversation: conversationPage().content[0]!,
        })}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    const composer = screen.getByRole("textbox", { name: "Mesaj" });
    expect(composer).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(composer).toBeEnabled();
    await user.type(composer, "Merhaba");
    expect(screen.getByRole("button", { name: "Gönder" })).toBeEnabled();
  });

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

  it.each(["/panel/mesajlar", "/isveren/mesajlar"])(
    "%s sonraki sayfa konuşma linkine server lookup ipucunu ekler",
    (basePath) => {
      const laterPage = {
        ...conversationPage(),
        page: 3,
        content: [{ ...conversationPage().content[0]!, sourcePage: 3 }],
      };
      render(
        <ConversationList
          initialPage={laterPage}
          viewerId={viewerId}
          basePath={basePath}
          realtimeClient={new FakeRealtime()}
          confirmPresence={vi.fn().mockResolvedValue(true)}
        />,
      );

      expect(screen.getByRole("link", { name: /Ece Yılmaz/ })).toHaveAttribute(
        "href",
        `${basePath}/${conversationId}?conversationPage=3`,
      );
    },
  );

  it.each(["/panel/mesajlar", "/isveren/mesajlar"])(
    "%s sonraki sayfadaki konuşma realtime mesajla üste taşınınca lookup ipucunu sıfırlar",
    async (basePath) => {
      const realtime = new FakeRealtime();
      const laterPage = {
        ...conversationPage(),
        page: 3,
        content: [{ ...conversationPage().content[0]!, sourcePage: 3 }],
      };
      render(
        <ConversationList
          initialPage={laterPage}
          viewerId={viewerId}
          basePath={basePath}
          realtimeClient={realtime}
          confirmPresence={vi.fn().mockResolvedValue(true)}
        />,
      );

      await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
      act(() => realtime.emitPersonal(event("MESSAGE", message("Yeni mesaj", otherId))));

      expect(screen.getByRole("link", { name: /Ece Yılmaz/ })).toHaveAttribute(
        "href",
        `${basePath}/${conversationId}?conversationPage=0`,
      );
    },
  );

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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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

    expect(screen.getByRole("button", { name: "Gönder" }))
      .toHaveAttribute("data-disabled-kind", "permanent");
    await user.type(screen.getByRole("textbox", { name: "Mesaj" }), "Geliyorum");
    expect(screen.getByRole("button", { name: "Gönder" })).not.toHaveAttribute("data-disabled-kind");
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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
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
    expect(screen.getByRole("button", { name: "Gönder" }))
      .toHaveAttribute("data-disabled-kind", "permanent");
    expect(screen.queryByRole("button", { name: "Kullanıcıyı engelle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Engeli kaldır" })).toBeNull();
  });

  it("ödeme ve pencere reddini kataloğ metniyle gösterir, öteki redleri geçici sayar", async () => {
    // İki kod `errorCode` ile ayrışıyor ve yeniden denemek işe yaramaz;
    // metin `src/lib/errors.ts` ile aynı (#157). Bilinmeyen red genel cümleyi
    // korur: "tekrar deneyebilirsin".
    const cases = [
      ["MESSAGING_PAYMENT_REQUIRED", 403, errorPresentation("MESSAGING_PAYMENT_REQUIRED", 403).message],
      ["MESSAGING_WINDOW_CLOSED", 409, errorPresentation("MESSAGING_WINDOW_CLOSED", 409).message],
      ["SOMETHING_ELSE", 500, "Mesaj gönderilemedi. Tekrar deneyebilirsin."],
    ] as const;

    for (const [errorCode, status, expected] of cases) {
      const { unmount } = render(
        <ConversationThread
          conversationId={conversationId}
          initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
          initialMessages={messagePage([])}
          viewerId={viewerId}
          basePath="/panel/mesajlar"
          realtimeClient={new FakeRealtime()}
          confirmConversation={vi.fn().mockResolvedValue(true)}
          confirmPresence={vi.fn().mockResolvedValue(true)}
          sendMessage={vi.fn().mockResolvedValue({ ok: false, errorCode, status, blocked: false })}
          markRead={vi.fn().mockResolvedValue(true)}
        />,
      );

      fireEvent.change(screen.getByRole("textbox", { name: "Mesaj" }), {
        target: { value: "Merhaba" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Gönder" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(expected);
      // Ödeme reddi engel değil: composer açık kalır, kullanıcı sayfada
      // kilitlenmez.
      expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeEnabled();
      unmount();
    }
  });

  it("grup sohbetini ilan başlığı ve katılımcılarıyla listeler", async () => {
    // Grup ilan başına kuruluyor (ödeme emanete düşünce) ve şirket
    // yetkilileri de katılımcı: satır kiminle yazışıldığını adlarla söyler,
    // avatar ve presence tek bir karşı tarafa bağlı olmadığı için kapalı.
    const realtime = new FakeRealtime();
    const group: ConversationSummary = {
      ...conversationPage().content[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      jobTitle: "Depo sayımı",
      kind: "GROUP",
      displayName: "Depo sayımı",
      participantCount: 4,
      participantNames: ["Ayşe Yıldız", "Mehmet Kaya", "Zeynep Demir"],
      counterpartId: null,
      profilePictureUrl: null,
      online: null,
    };
    render(
      <ConversationList
        initialPage={{ ...conversationPage(), content: [group] }}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={realtime}
        confirmPresence={vi.fn().mockResolvedValue(true)}
      />,
    );

    const row = screen.getByRole("link", { name: /Depo sayımı/ });
    expect(row).toHaveAttribute("href", `/isveren/mesajlar/${group.id}?conversationPage=0`);
    expect(within(row).getByText("Depo sayımı", { selector: "strong" })).toBeVisible();
    expect(within(row).getByText(
      "Grup sohbeti · 4 katılımcı: Ayşe Yıldız, Mehmet Kaya, Zeynep Demir",
    )).toBeVisible();
    await waitFor(() => expect(realtime.personalListeners).toHaveLength(1));
    expect(realtime.followedPresence).toEqual([]);
  });

  it("erişilebilir onaydan sonra karşı tarafı engeller ve composer'ı anında kapatır", async () => {
    const user = userEvent.setup();
    const blockUser = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ConversationThread
        conversationId={conversationId}
        conversationPage={3}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        blockConversationUser={blockUser}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Kullanıcıyı engelle" }));
    const dialog = screen.getByRole("dialog", { name: "Kullanıcıyı engelle" });
    expect(dialog).toHaveTextContent("iki taraf da mesaj gönderemeyecek");
    await user.click(within(dialog).getByRole("button", { name: "Engellemeyi onayla" }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith(conversationId, 3));
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Engeli kaldır" })).toBeVisible();
  });

  it("engelleme onayı uçuşa geçtiği anda composer'ı kapatır ve hata halinde geri açar", async () => {
    const user = userEvent.setup();
    let settle!: (result: MessagingMutationResult) => void;
    const blockUser = vi.fn(() => new Promise<MessagingMutationResult>((resolve) => {
      settle = resolve;
    }));
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        blockConversationUser={blockUser}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Kullanıcıyı engelle" }));
    const dialog = screen.getByRole("dialog", { name: "Kullanıcıyı engelle" });
    await user.click(within(dialog).getByRole("button", { name: "Engellemeyi onayla" }));

    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
    act(() => settle({
      ok: false,
      errorCode: "SERVICE_UNAVAILABLE",
      status: 503,
      blocked: false,
    }));
    await within(dialog).findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeEnabled();
  });

  it("engelleme aksiyonu reject olursa modalı tekrar kullanılabilir ve composer'ı açık bırakır", async () => {
    const user = userEvent.setup();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        blockConversationUser={vi.fn().mockRejectedValue(new Error("private rejection detail"))}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Kullanıcıyı engelle" }));
    const dialog = screen.getByRole("dialog", { name: "Kullanıcıyı engelle" });
    await user.click(within(dialog).getByRole("button", { name: "Engellemeyi onayla" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("İşlemi şu anda tamamlayamadık");
    expect(alert).not.toHaveTextContent("private rejection detail");
    expect(within(dialog).getByRole("button", { name: "Tekrar dene" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeEnabled();
  });

  it("diyaloğu klavyede çevreler, Escape ile kapatır ve odağı tetikleyiciye döndürür", async () => {
    const user = userEvent.setup();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Kullanıcıyı engelle" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Kullanıcıyı engelle" });
    const cancel = within(dialog).getByRole("button", { name: "Vazgeç" });
    const confirm = within(dialog).getByRole("button", { name: "Engellemeyi onayla" });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("yalnız açık onaydan sonra kendi koyduğu engeli kaldırıp composer'ı açar", async () => {
    const user = userEvent.setup();
    const unblockUser = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        initialBlockedByViewer
        unblockConversationUser={unblockUser}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Engeli kaldır" }));
    const dialog = screen.getByRole("dialog", { name: "Engeli kaldır" });
    expect(unblockUser).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Engeli kaldırmayı onayla" }));

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith(conversationId, 0));
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Kullanıcıyı engelle" })).toBeVisible();
  });

  it("engel kaldırma aksiyonu reject olursa modalı açar ama composer kilidini korur", async () => {
    const user = userEvent.setup();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([])}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        initialBlockedByViewer
        unblockConversationUser={vi.fn().mockRejectedValue(new Error("private rejection detail"))}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Engeli kaldır" }));
    const dialog = screen.getByRole("dialog", { name: "Engeli kaldır" });
    await user.click(within(dialog).getByRole("button", { name: "Engeli kaldırmayı onayla" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("İşlemi şu anda tamamlayamadık");
    expect(within(dialog).getByRole("button", { name: "Tekrar dene" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();
  });

  it("duplicate üretebilen kullanıcı-geneli şikâyet yüzeyini sunmaz", () => {
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([message("Şikâyet edilebilir mesaj", otherId)])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Kullanıcıyı şikâyet et" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ })).toBeVisible();
  });

  it("yalnız karşı tarafın mesajını konuşma bağlamıyla şikâyet eder", async () => {
    const user = userEvent.setup();
    const reportMessage = vi.fn().mockResolvedValue({
      ok: true,
      reportId: "88888888-8888-4888-8888-888888888888",
    });
    const theirs = message("Uygunsuz mesaj", otherId);
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([theirs])}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        reportMessage={reportMessage}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ }));
    const dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "INAPPROPRIATE_CONTENT");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));

    await waitFor(() => expect(reportMessage).toHaveBeenCalledWith(
      conversationId,
      theirs.id,
      "INAPPROPRIATE_CONTENT",
      "",
    ));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("birden çok mesajın şikâyet düğmesini erişilebilir adında ayırt eder", () => {
    const first = message("İlk uygunsuz mesaj", otherId);
    const second = {
      ...message("İkinci uygunsuz mesaj", otherId),
      id: "55555555-5555-4555-8555-555555555555",
      sentAt: "2026-09-06T11:05:00Z",
    };
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([first, second])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByRole("button", { name: /14:00.*İlk uygunsuz mesaj/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /14:05.*İkinci uygunsuz mesaj/ })).toBeVisible();
  });

  it("her yeni şikâyette başarı durumunu sıfırlayıp yeniden duyurur", async () => {
    const user = userEvent.setup();
    const theirs = message("Şikâyet edilebilir mesaj", otherId);
    const reportMessage = vi.fn().mockResolvedValue({
      ok: true,
      reportId: "88888888-8888-4888-8888-888888888888",
    });
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([theirs])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        reportMessage={reportMessage}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    const trigger = screen.getByRole("button", { name: /^Mesajı şikâyet et:/ });
    await user.click(trigger);
    let dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "SPAM");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Şikâyetin alındı");

    await user.click(trigger);
    expect(screen.queryByRole("status")).toBeNull();
    dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "OTHER");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Şikâyetin alındı");
    expect(reportMessage).toHaveBeenCalledTimes(2);
  });

  it("şikâyet hatasını requestId ile gösterip aynı güvenli işlemi yeniden dener", async () => {
    const user = userEvent.setup();
    const theirs = message("Şikâyet edilebilir mesaj", otherId);
    const reportMessage = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        errorCode: "SERVICE_UNAVAILABLE",
        status: 503,
        blocked: false,
        requestId: "request-report-117",
      })
      .mockResolvedValueOnce({
        ok: true,
        reportId: "88888888-8888-4888-8888-888888888888",
      });
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([theirs])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        reportMessage={reportMessage}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ }));
    const dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "SPAM");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("request-report-117");
    await user.click(within(dialog).getByRole("button", { name: "Tekrar dene" }));

    await waitFor(() => expect(reportMessage).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("şikâyet aksiyonu reject olursa alanları ve güvenli tekrar denemeyi geri açar", async () => {
    const user = userEvent.setup();
    const theirs = message("Şikâyet edilebilir mesaj", otherId);
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([theirs])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        reportMessage={vi.fn().mockRejectedValue(new Error("private rejection detail"))}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ }));
    const dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "SPAM");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("İşlemi şu anda tamamlayamadık");
    expect(alert).not.toHaveTextContent("private rejection detail");
    expect(within(dialog).getByLabelText("Gerekçe")).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Tekrar dene" })).toBeEnabled();
  });

  it("farklı içerikle yinelenen mesaj şikâyetini kalıcı açıklar ve retry sunmaz", async () => {
    const user = userEvent.setup();
    const theirs = message("Şikâyet edilen mesaj", otherId);
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([theirs])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={new FakeRealtime()}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        reportMessage={vi.fn().mockResolvedValue({
          ok: false,
          errorCode: "REPORT_IDEMPOTENCY_CONFLICT",
          status: 409,
          blocked: false,
          requestId: "request-report-conflict-117",
        })}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mesajı şikâyet et:/ }));
    const dialog = screen.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await user.selectOptions(within(dialog).getByLabelText("Gerekçe"), "FRAUD");
    await user.click(within(dialog).getByRole("button", { name: "Şikâyeti gönder" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bu mesajı daha önce farklı bilgilerle şikâyet ettin",
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent("request-report-conflict-117");
    expect(within(dialog).queryByRole("button", { name: "Tekrar dene" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Şikâyeti gönder" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Kapat" })).toBeEnabled();
    expect(within(dialog).getByLabelText("Gerekçe")).toBeDisabled();
  });
});

describe("grup sohbeti (is-koala/koala-web#167)", () => {
  const thirdId = "55555555-5555-4555-8555-555555555555";
  const leftId = "66666666-6666-4666-8666-666666666666";
  const groupId = "44444444-4444-4444-8444-444444444444";

  function groupConversation(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
    return {
      ...conversationPage().content[0]!,
      id: groupId,
      jobId: "77777777-7777-4777-8777-777777777777",
      jobTitle: "Depo sayımı",
      kind: "GROUP",
      displayName: "Depo sayımı",
      participantCount: 3,
      participantNames: ["Ece Yılmaz", "Mehmet Kaya"],
      participants: [
        participant(viewerId, "Deniz Ak", { role: "EMPLOYER", joinedAt: "2026-09-01T09:00:00Z" }),
        participant(otherId, "Ece Yılmaz", {
          role: "WORKER",
          joinedAt: "2026-09-02T09:00:00Z",
          lastReadAt: "2026-09-06T11:30:00Z",
        }),
        participant(thirdId, "Mehmet Kaya", {
          role: "COMPANY_CONTACT",
          joinedAt: "2026-09-01T09:00:00Z",
          lastReadAt: "2026-09-06T10:00:00Z",
        }),
        participant(leftId, "Zeynep Demir", {
          role: "WORKER",
          joinedAt: "2026-09-01T09:00:00Z",
          lastReadAt: "2026-09-06T09:00:00Z",
          left: true,
        }),
      ],
      readReceipts: true,
      counterpartId: null,
      profilePictureUrl: null,
      online: null,
      ...overrides,
    };
  }

  function renderGroup(
    conversation: ConversationSummary,
    messages: Message[],
    realtime = new FakeRealtime(),
    basePath = "/isveren/mesajlar",
  ) {
    return render(
      <ConversationThread
        conversationId={groupId}
        initialSummary={{ ok: true, conversation }}
        initialMessages={messagePage(messages)}
        viewerId={viewerId}
        basePath={basePath}
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );
  }

  it("grup balonunda gönderen adını yazar; kendi mesajında yazmaz, ayrılanı işaretler", () => {
    renderGroup(groupConversation(), [
      message("Sunucu adıyla", otherId, { id: "m1", senderName: "Ece Y.", sentAt: "2026-09-06T10:00:00Z" }),
      message("Eşlemeyle", thirdId, { id: "m2", sentAt: "2026-09-06T10:01:00Z" }),
      message("Ayrılandan", leftId, { id: "m3", sentAt: "2026-09-06T10:02:00Z" }),
      message("Listede olmayandan", "unknown-user", { id: "m4", sentAt: "2026-09-06T10:03:00Z" }),
      message("Benden", viewerId, { id: "m5", sentAt: "2026-09-06T10:04:00Z" }),
    ]);

    const bubbleOf = (body: string) => screen.getByText(body).closest("article")!;
    expect(within(bubbleOf("Sunucu adıyla")).getByText("Ece Y.")).toBeVisible();
    expect(within(bubbleOf("Eşlemeyle")).getByText("Mehmet Kaya")).toBeVisible();
    const left = within(bubbleOf("Ayrılandan"));
    expect(left.getByText("Zeynep Demir")).toBeVisible();
    expect(left.getByText("Ayrıldı")).toBeVisible();
    const unknown = within(bubbleOf("Listede olmayandan"));
    expect(unknown.getByText("Ayrılan katılımcı")).toBeVisible();
    expect(unknown.getByText("Ayrıldı")).toBeVisible();
    expect(bubbleOf("Benden").querySelector(".message-sender")).toBeNull();
    expect(within(bubbleOf("Benden")).queryByText("Deniz Ak")).toBeNull();
  });

  it("ikili sohbette gönderen adı yazmaz ve okundu davranışı korunur", () => {
    const realtime = new FakeRealtime();
    render(
      <ConversationThread
        conversationId={conversationId}
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
        initialMessages={messagePage([
          message("Ondan", otherId, { id: "d1", senderName: "Ece Yılmaz", sentAt: "2026-09-06T10:00:00Z" }),
          message("Benden", viewerId, { id: "d2", sentAt: "2026-09-06T10:01:00Z" }),
        ])}
        viewerId={viewerId}
        basePath="/panel/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        confirmPresence={vi.fn().mockResolvedValue(true)}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(document.querySelector(".message-sender")).toBeNull();
    const mine = screen.getByText("Benden").closest("article")!;
    expect(within(mine).getByText("Gönderildi")).toBeVisible();
    expect(within(mine).queryByText(/kişi gördü/)).toBeNull();

    act(() => realtime.emitPersonal({
      type: "READ",
      conversationId,
      userId: otherId,
      message: null,
      online: null,
      at: "2026-09-06T10:05:00Z",
      lastReadAt: "2026-09-06T10:05:00Z",
      error: null,
    }));

    expect(within(mine).getByText("Okundu")).toBeVisible();
  });

  it("grupta kendi mesajının altında görenleri sayar, listeler ve READ olayıyla canlı günceller", async () => {
    const user = userEvent.setup();
    const realtime = new FakeRealtime();
    renderGroup(groupConversation(), [
      message("Herkes gördü mü?", viewerId, { id: "g1", sentAt: "2026-09-06T09:30:00Z" }),
      message("Yeni mesaj", viewerId, { id: "g2", sentAt: "2026-09-06T11:00:00Z" }),
      message("En yeni", viewerId, { id: "g3", sentAt: "2026-09-06T12:00:00Z" }),
    ], realtime);

    // 09:30: Ece (11:30), Mehmet (10:00) ve ayrılmadan önce okuyan Zeynep (09:00 → hayır).
    const oldest = screen.getByText("Herkes gördü mü?").closest("article")!;
    expect(within(oldest).getByText("2 kişi gördü")).toBeVisible();
    await user.click(within(oldest).getByText("2 kişi gördü"));
    const seenList = within(oldest).getByRole("list");
    expect(within(seenList).getByText("Ece Yılmaz")).toBeVisible();
    expect(within(seenList).getByText("Mehmet Kaya")).toBeVisible();
    expect(within(seenList).queryByText("Deniz Ak")).toBeNull();

    const middle = screen.getByText("Yeni mesaj").closest("article")!;
    expect(within(middle).getByText("1 kişi gördü")).toBeVisible();
    const newest = screen.getByText("En yeni").closest("article")!;
    expect(within(newest).getByText("Gönderildi")).toBeVisible();
    expect(within(newest).queryByText("Okundu")).toBeNull();

    // Mehmet 12:30'da okudu: üç mesajı da görmüş olur; kendi READ'im sayıya girmez.
    act(() => realtime.emitPersonal({
      type: "READ",
      conversationId: groupId,
      userId: thirdId,
      message: null,
      online: null,
      at: "2026-09-06T12:30:01Z",
      lastReadAt: "2026-09-06T12:30:00Z",
      error: null,
    }));
    act(() => realtime.emitPersonal({
      type: "READ",
      conversationId: groupId,
      userId: viewerId,
      message: null,
      online: null,
      at: "2026-09-06T12:31:00Z",
      lastReadAt: "2026-09-06T12:31:00Z",
      error: null,
    }));

    expect(within(newest).getByText("1 kişi gördü")).toBeVisible();
    expect(within(middle).getByText("2 kişi gördü")).toBeVisible();
    expect(within(newest).queryByText("Gönderildi")).toBeNull();
  });

  it("listede olmayan okuyucunun READ olayında özeti bir kez tazeler ve sayıyı artırır", async () => {
    // Sayfa açıldıktan sonra katılan biri READ gönderiyor: olay damgayı
    // taşıyor ama kişiyi taşımıyor. Özet yeniden okunur; yoldayken gelen
    // damga (12:20) özettekinden (12:10) ileri olduğu için korunur.
    const newcomerId = "77777777-7777-4777-8777-777777777777";
    const realtime = new FakeRealtime();
    const refreshed = groupConversation({
      participants: [
        ...groupConversation().participants,
        participant(newcomerId, "Ali Can", { role: "WORKER", lastReadAt: "2026-09-06T12:10:00Z" }),
      ],
    });
    const loadSummary = vi.fn().mockResolvedValue({ ok: true, conversation: refreshed });
    render(
      <ConversationThread
        conversationId={groupId}
        initialSummary={{ ok: true, conversation: groupConversation() }}
        initialMessages={messagePage([
          message("Yeni gelen görecek mi?", viewerId, { id: "g1", sentAt: "2026-09-06T12:00:00Z" }),
        ])}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        loadSummary={loadSummary}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );
    const bubble = screen.getByText("Yeni gelen görecek mi?").closest("article")!;
    expect(within(bubble).getByText("Gönderildi")).toBeVisible();

    const readBy = (userId: string, lastReadAt: string) => act(() => realtime.emitPersonal({
      type: "READ", conversationId: groupId, userId, message: null, online: null,
      at: lastReadAt, lastReadAt, error: null,
    }));
    readBy(newcomerId, "2026-09-06T12:20:00Z");
    readBy(newcomerId, "2026-09-06T12:21:00Z");

    await waitFor(() => expect(within(bubble).getByText("1 kişi gördü")).toBeVisible());
    expect(loadSummary).toHaveBeenCalledTimes(1);
    expect(loadSummary).toHaveBeenCalledWith(groupId, 0);
    fireEvent.click(within(bubble).getByText("1 kişi gördü"));
    expect(within(bubble).getByRole("listitem")).toHaveTextContent("Ali Can");
    expect(within(bubble).getByRole("listitem")).toHaveTextContent("6 Eyl 15:21");
  });

  it("bağlantı kopup yeniden kurulunca damgaları özetten tazeler; ilk kuruluşta tazelemez", async () => {
    const realtime = new FakeRealtime();
    realtime.state = { phase: "connecting", mode: "rest" };
    const loadSummary = vi.fn().mockResolvedValue({
      ok: true,
      conversation: groupConversation({
        participants: groupConversation().participants.map((item) =>
          item.id === thirdId ? { ...item, lastReadAt: "2026-09-06T12:30:00Z" } : item,
        ),
      }),
    });
    render(
      <ConversationThread
        conversationId={groupId}
        initialSummary={{ ok: true, conversation: groupConversation() }}
        initialMessages={messagePage([
          message("Kopukken okundu", viewerId, { id: "g1", sentAt: "2026-09-06T12:00:00Z" }),
        ])}
        viewerId={viewerId}
        basePath="/isveren/mesajlar"
        realtimeClient={realtime}
        confirmConversation={vi.fn().mockResolvedValue(true)}
        loadSummary={loadSummary}
        markRead={vi.fn().mockResolvedValue(true)}
      />,
    );
    const bubble = screen.getByText("Kopukken okundu").closest("article")!;

    act(() => realtime.emitState({ phase: "live", mode: "realtime" }));
    expect(loadSummary).not.toHaveBeenCalled();
    act(() => realtime.emitState({ phase: "reconnecting", mode: "rest", retryInMs: 1_000 }));
    act(() => realtime.emitState({ phase: "live", mode: "realtime" }));

    await waitFor(() => expect(within(bubble).getByText("1 kişi gördü")).toBeVisible());
    expect(loadSummary).toHaveBeenCalledTimes(1);
  });

  it("eski sunucu READ olayında damga yoksa olayın zamanına düşer", () => {
    const realtime = new FakeRealtime();
    renderGroup(groupConversation(), [
      message("Damgasız", viewerId, { id: "g1", sentAt: "2026-09-06T12:00:00Z" }),
    ], realtime);
    const bubble = screen.getByText("Damgasız").closest("article")!;
    expect(within(bubble).getByText("Gönderildi")).toBeVisible();

    act(() => realtime.emitPersonal({
      type: "READ",
      conversationId: groupId,
      userId: otherId,
      message: null,
      online: null,
      at: "2026-09-06T12:05:00Z",
      error: null,
    }));

    expect(within(bubble).getByText("1 kişi gördü")).toBeVisible();
  });

  it("sunucu lastReadAt taşımıyorsa grupta görüldü bilgisini hiç çizmez", () => {
    renderGroup(groupConversation({
      readReceipts: false,
      participants: groupConversation().participants.map((item) => ({ ...item, lastReadAt: null })),
    }), [
      message("Eski sunucu", viewerId, { id: "g1", sentAt: "2026-09-06T12:00:00Z" }),
    ]);

    const bubble = screen.getByText("Eski sunucu").closest("article")!;
    expect(within(bubble).queryByText(/kişi gördü/)).toBeNull();
    expect(within(bubble).queryByText("Gönderildi")).toBeNull();
    expect(within(bubble).queryByText("Okundu")).toBeNull();
  });

  it("başlık katılımcılar panelini açar: rol, katılma tarihi, ayrılan gri, aday dosyası bağlantısı", async () => {
    const user = userEvent.setup();
    renderGroup(groupConversation(), []);

    const trigger = within(screen.getByRole("heading", { level: 1 })).getByRole("button", { name: "Depo sayımı" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Katılımcılar" });
    expect(dialog).toBeVisible();
    expect(within(dialog).queryByRole("note")).toBeNull();
    const rows = within(within(dialog).getByRole("list", { name: "Katılımcılar" })).getAllByRole("listitem");
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent("Deniz Ak");
    expect(rows[0]).toHaveTextContent("(sen)");
    expect(rows[0]).toHaveTextContent("İşveren");
    expect(rows[0]).toHaveTextContent("Katıldı: 1 Eylül 2026");
    // İşveren kabuğunda kendi satırının gideceği bir profil sayfası yok.
    expect(within(rows[0]!).queryByRole("link")).toBeNull();

    expect(rows[1]).toHaveTextContent("Ece Yılmaz");
    expect(rows[1]).toHaveTextContent("Çalışan");
    expect(rows[1]).toHaveTextContent("Katıldı: 2 Eylül 2026");
    expect(within(rows[1]!).getByRole("link", { name: "Aday dosyası" }))
      .toHaveAttribute("href", "/isveren/ilan/77777777-7777-4777-8777-777777777777/basvurular");

    expect(rows[2]).toHaveTextContent("Mehmet Kaya");
    expect(rows[2]).toHaveTextContent("Şirket yetkilisi");
    expect(within(rows[2]!).queryByRole("link")).toBeNull();

    // Ayrılan listenin sonunda, gri ve rozetli.
    expect(rows[3]).toHaveTextContent("Zeynep Demir");
    expect(rows[3]).toHaveClass("participant-row-left");
    expect(within(rows[3]!).getByText("Ayrıldı")).toBeVisible();
    expect(within(rows[3]!).queryByRole("link")).toBeNull();
  });

  it("çalışan kabuğunda kendi satırı profiline bağlanır ve kapalı sohbet notu görünür", async () => {
    const user = userEvent.setup();
    renderGroup(groupConversation({ closed: true }), [], new FakeRealtime(), "/panel/mesajlar");

    await user.click(screen.getByRole("button", { name: "Depo sayımı" }));

    const dialog = screen.getByRole("dialog", { name: "Katılımcılar" });
    expect(within(dialog).getByRole("note")).toHaveTextContent("Bu konuşma kapandı");
    const rows = within(dialog).getAllByRole("listitem");
    expect(within(rows[0]!).getByRole("link", { name: "Profilim" })).toHaveAttribute("href", "/panel/profil");
    expect(within(rows[1]!).queryByRole("link")).toBeNull();
  });

  it("eski sunucuda rol ve katılma tarihi yoksa satır yalnız adı yazar", async () => {
    const user = userEvent.setup();
    renderGroup(groupConversation({
      readReceipts: false,
      participants: [
        participant(viewerId, "Deniz Ak", { joinedAt: null }),
        participant(otherId, "Ece Yılmaz", { joinedAt: null }),
      ],
    }), []);

    await user.click(screen.getByRole("button", { name: "Depo sayımı" }));

    const rows = within(screen.getByRole("dialog", { name: "Katılımcılar" })).getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent("Ece Yılmaz");
    expect(rows[1]).not.toHaveTextContent("Katıldı");
    expect(rows[1]).not.toHaveTextContent(/İşveren|Çalışan|Şirket yetkilisi/);
  });

  it("katılımcılar paneli klavyeyle açılır, odağı çevreler ve Escape ile tetikleyiciye döner", async () => {
    const user = userEvent.setup();
    renderGroup(groupConversation(), []);

    const trigger = screen.getByRole("button", { name: "Depo sayımı" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Katılımcılar" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("link", { name: "Aday dosyası" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Kapat" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("link", { name: "Aday dosyası" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Mesaj" }).closest("form")).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("ikili sohbette de başlık iki katılımcıyı listeler", async () => {
    const user = userEvent.setup();
    render(
      <ConversationThreadForSummary
        initialSummary={{ ok: true, conversation: conversationPage().content[0]! }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ece Yılmaz" }));

    const rows = within(screen.getByRole("dialog", { name: "Katılımcılar" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Deniz Ak");
    expect(rows[1]).toHaveTextContent("Ece Yılmaz");
  });
});

class FakeRealtime implements RealtimeClient {
  personalListeners: RealtimeEventListener[] = [];
  activeConversationListeners: RealtimeEventListener[] = [];
  followedConversations: string[] = [];
  followedPresence: string[] = [];
  state: RealtimeConnectionState = { phase: "live", mode: "realtime" };
  stateListeners: Array<(state: RealtimeConnectionState) => void> = [];
  start = vi.fn();
  stop = vi.fn();
  getState = () => this.state;
  onStateChange(listener: (state: RealtimeConnectionState) => void) {
    this.stateListeners.push(listener);
    listener(this.state);
    return () => { this.stateListeners = this.stateListeners.filter((item) => item !== listener); };
  }
  emitState(state: RealtimeConnectionState) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
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
      kind: "DIRECT",
      displayName: "Ece Yılmaz",
      participantCount: 2,
      participantNames: ["Ece Yılmaz"],
      participants: [
        participant(viewerId, "Deniz Ak", { role: "EMPLOYER" }),
        participant(otherId, "Ece Yılmaz", { role: "WORKER" }),
      ],
      readReceipts: true,
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

function message(body: string, senderId: string, overrides: Partial<Message> = {}): Message {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    senderId,
    senderName: null,
    body,
    sentAt: "2026-09-06T11:00:00Z",
    readAt: null,
    ...overrides,
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

function ConversationThreadForSummary({
  initialSummary,
  loadSummary,
  initialMessages = messagePage([]),
}: {
  initialSummary: React.ComponentProps<typeof ConversationThread>["initialSummary"];
  loadSummary?: React.ComponentProps<typeof ConversationThread>["loadSummary"];
  initialMessages?: Page<Message>;
}) {
  return (
    <ConversationThread
      conversationId={conversationId}
      initialSummary={initialSummary}
      initialMessages={initialMessages}
      viewerId={viewerId}
      basePath="/panel/mesajlar"
      realtimeClient={new FakeRealtime()}
      confirmConversation={vi.fn().mockResolvedValue(true)}
      confirmPresence={vi.fn().mockResolvedValue(true)}
      loadSummary={loadSummary}
      markRead={vi.fn().mockResolvedValue(true)}
    />
  );
}
