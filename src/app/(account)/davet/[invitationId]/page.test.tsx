import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../tests/support/control-flow";

import { InvitationPanel } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getInvitation = vi.hoisted(() => vi.fn());
const invitationPageView = vi.hoisted(() => vi.fn(() => <div>davet</div>));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/company/invitations", () => ({ getInvitation }));
vi.mock("@/components/company/invitation-page", () => ({
  InvitationPageView: invitationPageView,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const viewerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("şirket daveti paneli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("davet okunurken biten oturumun yönlendirmesini hata kartına dönüştürmez", async () => {
    // `(uygulama)` dışında ama oturumlu: kapı `enterShell()`, davet `apiRequest`
    // ile okunuyor. Panel doğrudan çağrılıyor; `render` içinde askıya giren
    // bir sunucu bileşeninin reddi görünmez olurdu.
    const interrupt = sessionExpiryRedirect(`/giris?next=%2Fdavet%2F${invitationId}`);
    getInvitation.mockRejectedValue(interrupt);

    await expect(InvitationPanel({ invitationId, viewerId })).rejects.toBe(interrupt);
  });

  it("bulunamayan daveti koddan seçilen Türkçe metinle gösterir", async () => {
    // Okuma ucu sahiplik denetimi yapmadığı için 404 "var ama senin değil"i de
    // kapsıyor; metin `errorPresentation`'dan, ham mesaj ekrana çıkmıyor.
    getInvitation.mockRejectedValue(
      new ApiError({
        status: 404,
        errorCode: "COMPANY_CONTACT_INVITATION_NOT_FOUND",
        errorCategory: "RESOURCE_NOT_FOUND",
        message: "ham mesaj",
      }),
    );

    render(await InvitationPanel({ invitationId, viewerId }));

    expect(screen.getByRole("alert")).toHaveTextContent("Davet bulunamadı");
    expect(screen.queryByText("ham mesaj")).toBeNull();
    expect(invitationPageView).not.toHaveBeenCalled();
  });

  it("backend arızasında koddan seçilmiş Türkçe hata gösterir", async () => {
    getInvitation.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    render(await InvitationPanel({ invitationId, viewerId }));

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("ham mesaj")).toBeNull();
    expect(invitationPageView).not.toHaveBeenCalled();
  });
});
