import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnsubscribePanel } from "./unsubscribe-panel";

const token = "gizli-abonelik-tokeni_0123456789";

function openLink(search: string) {
  window.history.replaceState({}, "", `/bildirim-tercihleri/cikis${search}`);
}

function bffResponds(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function confirm() {
  await userEvent.click(screen.getByRole("button", { name: "Abonelikten çık" }));
}

describe("abonelikten çıkma paneli", () => {
  beforeEach(() => {
    openLink(`?token=${token}`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    openLink("");
  });

  it("açılışta hiçbir istek atmaz; tercih yalnız onayla değişir", async () => {
    // E-posta tarayıcıları ve bağlantı önizleyicileri sayfayı GET ile açıyor;
    // açılışın kendisi aboneliği kapatsaydı uç POST seçilmesinin anlamı kalmazdı.
    const fetchMock = bffResponds(200, {
      outcome: "unsubscribed",
      category: "MARKETINGS",
      channel: "EMAIL",
      alreadyDisabled: false,
    });

    render(<UnsubscribePanel />);

    expect(screen.getByRole("button", { name: "Abonelikten çık" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
    // Token adreste kalıyor: gizli alana ya da başka bir DOM düğümüne yazılmıyor.
    expect(document.body.innerHTML).not.toContain(token);

    await confirm();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/notification-preferences/unsubscribe");
    expect(init.method).toBe("POST");
    // Onaylanınca token gövdede gidiyor.
    expect(JSON.parse(init.body as string)).toEqual({ token });
  });

  it("kapatılan bildirim türünü ve kanalı gösterir", async () => {
    bffResponds(200, {
      outcome: "unsubscribed",
      category: "MARKETINGS",
      channel: "EMAIL",
      alreadyDisabled: false,
    });
    render(<UnsubscribePanel />);

    await confirm();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Abonelikten çıktın");
    expect(status).toHaveTextContent("Kampanya ve duyurular");
    expect(status).toHaveTextContent("E-posta");
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
    expect(document.body.innerHTML).not.toContain(token);
  });

  it("zaten kapalı kanalı hata olarak göstermez", async () => {
    bffResponds(200, {
      outcome: "unsubscribed",
      category: "NEWSLETTER",
      channel: "EMAIL",
      alreadyDisabled: true,
    });
    render(<UnsubscribePanel />);

    await confirm();

    expect(await screen.findByRole("status")).toHaveTextContent("Bu bildirimler zaten kapalı");
    expect(screen.getByRole("status")).toHaveTextContent("Bülten");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("süresi dolmuş bağlantıyı geçersizden ayrı anlatır", async () => {
    bffResponds(400, { outcome: "expired" });
    render(<UnsubscribePanel />);

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantının süresi dolmuş");
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
    expect(screen.queryByRole("button", { name: "Abonelikten çık" })).toBeNull();
  });

  it("tanınmayan bağlantıyı geçersiz olarak anlatır", async () => {
    bffResponds(400, { outcome: "invalid" });
    render(<UnsubscribePanel />);

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı geçersiz");
  });

  it("tokensız bağlantıyı istek atmadan geçersiz sayar", () => {
    const fetchMock = bffResponds(200, {});
    openLink("?token=bir&token=iki");

    render(<UnsubscribePanel />);

    expect(screen.getByRole("alert")).toHaveTextContent("Bağlantı geçersiz");
    expect(screen.queryByRole("button", { name: "Abonelikten çık" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geçici arızada herkese açık katalogdan metin gösterir ve yeniden denetir", async () => {
    const fetchMock = bffResponds(429, {
      outcome: "failed",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    render(<UnsubscribePanel />);

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme yaptın");
    expect(screen.getByRole("button", { name: "Abonelikten çık" })).toBeEnabled();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          outcome: "unsubscribed",
          category: "MARKETINGS",
          channel: "EMAIL",
          alreadyDisabled: false,
        }),
        { status: 200 },
      ),
    );
    await confirm();

    expect(await screen.findByRole("status")).toHaveTextContent("Abonelikten çıktın");
  });

  it("ağ hatasını başarı saymaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<UnsubscribePanel />);

    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
