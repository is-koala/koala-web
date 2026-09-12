import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../../tests/support/control-flow";

import { CompanyPanel } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getCompany = vi.hoisted(() => vi.fn());
const companyProfileView = vi.hoisted(() => vi.fn(() => <div>şirket profili</div>));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/company/company", () => ({ getCompany }));
vi.mock("@/components/company/company-profile", () => ({
  CompanyProfileView: companyProfileView,
}));

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("şirket profili paneli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("şirket okunurken biten oturumun yönlendirmesini hata kartına dönüştürmez", async () => {
    // Panel doğrudan çağrılıyor: `render` içinde askıya giren bir sunucu
    // bileşeninin reddi görünmez olurdu.
    const interrupt = sessionExpiryRedirect(`/giris?next=%2Fisveren%2Fsirket%2F${companyId}`);
    getCompany.mockRejectedValue(interrupt);

    await expect(CompanyPanel({ companyId, viewerRole: "ADMIN" })).rejects.toBe(interrupt);
  });

  it("backend arızasında koddan seçilmiş Türkçe hata gösterir", async () => {
    getCompany.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    render(await CompanyPanel({ companyId, viewerRole: "ADMIN" }));

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("ham mesaj")).toBeNull();
    expect(companyProfileView).not.toHaveBeenCalled();
  });

  it("bilinmeyen hatada nötr Türkçe yedeği gösterir", async () => {
    getCompany.mockRejectedValue(new Error("ağ koptu"));

    render(await CompanyPanel({ companyId, viewerRole: "ADMIN" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByText("ağ koptu")).toBeNull();
  });
});
