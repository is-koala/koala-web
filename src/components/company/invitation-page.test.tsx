import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";
import { type CompanyContactInvitation } from "@/lib/invitations";

import { InvitationPageView } from "./invitation-page";

const viewerId = "11111111-1111-4111-8111-111111111111";

const invitation: CompanyContactInvitation = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Koala Temizlik", logoUrl: null },
  invitedBy: {
    id: "22222222-2222-4222-8222-222222222222",
    firstName: "Yusuf",
    lastName: "Açmacı",
    username: "yusuf",
    profilePictureUrl: null,
  },
  invitedUser: {
    id: viewerId,
    firstName: "Emre",
    lastName: "Durusoy",
    username: "emre",
    profilePictureUrl: null,
  },
  role: "STAFF",
  status: "PENDING",
  invitedAt: "2026-08-01T09:00:00Z",
  answeredAt: null,
};

const idle = async (_state: FormState, _formData: FormData): Promise<FormState> => {
  void _state;
  void _formData;
  return { status: "idle" };
};

function renderPage(
  overrides: Partial<CompanyContactInvitation> = {},
  action = idle,
  currentViewerId = viewerId,
) {
  render(
    <InvitationPageView
      invitation={{ ...invitation, ...overrides }}
      viewerId={currentViewerId}
      action={action}
    />,
  );
  return userEvent.setup();
}

describe("davet karşılama sayfası", () => {
  afterEach(cleanup);

  it("kararı vermeden önce şirketi, davet edeni, rolü ve tarihi gösterir", () => {
    // Rol davet anında sabitlendi (`CompanyContactInvitationManager.java:50`):
    // kullanıcı seçemiyor, pazarlık edemiyor. Hangi rolle katılacağını kabul
    // etmeden önce görmeli.
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Koala Temizlik");
    expect(screen.getByText("Yusuf Açmacı")).toBeInTheDocument();
    expect(screen.getByText("İlan yetkilisi")).toBeInTheDocument();
    // Davetin son kullanma tarihi yok: aylar önce gönderilmiş bir davet hâlâ
    // kabul edilebilir, bu yüzden tarih ekranda.
    expect(screen.getByText("1 Ağu 2026 12:00")).toBeInTheDocument();
  });

  it("kabul ve reddi eşit görünürlükte sunar", () => {
    // E-posta zaten reddetme hakkını söylüyor; ekranın onu saklaması
    // kullanıcıyı kabul etmeye iter.
    renderPage();

    expect(screen.getByRole("button", { name: "Daveti kabul et" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Daveti reddet" })).toBeEnabled();
  });

  it("kabulü açık gövdeyle gönderir", async () => {
    const action = vi.fn(idle);
    const user = renderPage({}, action);

    await user.click(screen.getByRole("button", { name: "Daveti kabul et" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][1].get("accepted")).toBe("true");
  });

  it("reddi onay adımından geçirir ve açık gövdeyle gönderir", async () => {
    // Cevap geri alınamıyor: aynı davet ikinci kez cevaplanamaz ve geri alma
    // ucu yok.
    const action = vi.fn(idle);
    const user = renderPage({}, action);

    await user.click(screen.getByRole("button", { name: "Daveti reddet" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText(/geri alınamıyor/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Evet, reddet" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][1].get("accepted")).toBe("false");
  });

  it("ret sonrası hesapta hiçbir şeyin değişmediğini yazar", async () => {
    const user = renderPage({}, async () => ({ status: "done" }));

    await user.click(screen.getByRole("button", { name: "Daveti reddet" }));
    await user.click(screen.getByRole("button", { name: "Evet, reddet" }));

    expect(await screen.findByText(/hesabında hiçbir şey değişmedi/i)).toBeInTheDocument();
  });

  it("başkasına ait davette aksiyon çizmez ve nedenini yazar", () => {
    /*
     * `getInvitationById` sahiplik denetimi yapmıyor, `answerToInvitation`
     * ise 403 döndürüyor. Aksiyonları çizmek kullanıcıyı kesin bir reddin
     * üzerine sürerdi.
     */
    renderPage({}, idle, "99999999-9999-4999-8999-999999999999");

    expect(screen.queryByRole("button", { name: "Daveti kabul et" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Daveti reddet" })).not.toBeInTheDocument();
    expect(screen.getByText(/bu davet sana ait değil/i)).toBeInTheDocument();
  });

  it("cevaplanmış davette durumu ve cevaplanma tarihini gösterir", () => {
    renderPage({ status: "ACCEPTED", answeredAt: "2026-08-05T12:30:00Z" });

    expect(screen.queryByRole("button", { name: "Daveti kabul et" })).not.toBeInTheDocument();
    expect(screen.getByText("Kabul edildi")).toBeInTheDocument();
    expect(screen.getByText("5 Ağu 2026 15:30")).toBeInTheDocument();
  });

  it("ikinci cevaplamanın 409'unu ham hata yerine kendi metniyle gösterir", async () => {
    // İki sekmede açık bir davet ya da geri düğmesi bu duruma düşürebiliyor.
    const user = renderPage({}, async () => ({
      status: "error",
      errorCode: "INVITATION_ALREADY_ANSWERED",
      httpStatus: 409,
    }));

    await user.click(screen.getByRole("button", { name: "Daveti kabul et" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu davet daha önce cevaplanmış");
  });
});
