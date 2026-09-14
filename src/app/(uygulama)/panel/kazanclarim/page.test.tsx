import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import Page, { EarningsPage } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readWorkerPayouts = vi.hoisted(() => vi.fn());
const listBankAccounts = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const earningsRefresh = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payouts", () => ({ readWorkerPayouts }));
vi.mock("@/server/account-settings/settings", () => ({ listBankAccounts }));
vi.mock("@/app/(uygulama)/hesap-actions", () => ({
  addBankAccountAction: vi.fn(),
  deleteBankAccountAction: vi.fn(),
  selectPrimaryBankAccountAction: vi.fn(),
  startBankAccountVerificationAction: vi.fn(),
}));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("@/components/earnings-refresh", () => ({ EarningsRefresh: earningsRefresh }));

describe("Kazançlarım sayfası durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
    listBankAccounts.mockResolvedValue([]);
  });

  it("çalışan kabuğu kapısını veri okumadan önce taşır", () => {
    const route = Page();

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "worker", href: "/panel/kazanclarim" });
    expect(enterShell).not.toHaveBeenCalled();
    expect(readWorkerPayouts).not.toHaveBeenCalled();
  });

  it("ödeme çıkışı yoksa ayrı boş durumu gösterir", async () => {
    readWorkerPayouts.mockResolvedValue([]);

    render(await EarningsPage());

    expect(screen.getByRole("status")).toHaveTextContent("Henüz bir ödeme almadın.");
    // IBAN kartı ödeme yokken de durur: ödeme çıkışının önkoşulu.
    expect(screen.getByText("Henüz banka hesabın yok.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hesap ekle" })).toBeVisible();
  });

  it("banka hesaplarını doğrulama düğmesiyle listeler", async () => {
    readWorkerPayouts.mockResolvedValue([]);
    listBankAccounts.mockResolvedValue([
      {
        id: "08e9bbd8-9348-4667-9801-0e887824525a",
        maskedIban: "TR12 **** **** **** **** **99 01",
        primary: true,
        verificationStatus: "UNVERIFIED",
      },
    ]);

    render(await EarningsPage());

    expect(screen.getByText("TR12 **** **** **** **** **99 01")).toBeVisible();
    expect(screen.getByRole("button", { name: "IBAN'ı doğrula" })).toBeVisible();
  });

  it("banka hesapları okunamazsa ödemeleri yine gösterir", async () => {
    readWorkerPayouts.mockResolvedValue([]);
    listBankAccounts.mockRejectedValue(new ApiError({
      status: 503,
      errorCode: "EXTERNAL_SERVICE",
      errorCategory: "EXTERNAL_SERVICE",
      message: "internal backend message",
    }));

    render(await EarningsPage());

    expect(screen.getByRole("heading", { name: "Kazançlarım" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByRole("button", { name: "Hesap ekle" })).toBeNull();
  });

  it("ödeme çıkışlarını özet ve liste olarak gösterir", async () => {
    readWorkerPayouts.mockResolvedValue([{
      id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      assignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      amount: "1250.00",
      currency: "TRY",
      status: "COMPLETED",
      failureMessage: null,
      completedAt: "2026-09-05T11:00:00Z",
      createdAt: "2026-09-05T10:30:00Z",
    }]);

    render(await EarningsPage());

    expect(screen.getByRole("heading", { name: "Kazançlarım" })).toBeVisible();
    expect(earningsRefresh).toHaveBeenCalled();
    expect(screen.getByTestId("completed-total")).toHaveTextContent("1.250,00 ₺");
  });

  it("backend hatasını ham mesaj yerine koduyla gösterir", async () => {
    readWorkerPayouts.mockRejectedValue(new ApiError({
      status: 503,
      errorCode: "EXTERNAL_SERVICE",
      errorCategory: "EXTERNAL_SERVICE",
      message: "internal backend message",
    }));

    render(await EarningsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });

  it("oturum kapısı yönlendirirse ödeme isteğine çıkmaz", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(EarningsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(readWorkerPayouts).not.toHaveBeenCalled();
  });
});
