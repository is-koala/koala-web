import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../../../tests/support/control-flow";

import { EditPanel } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getCompany = vi.hoisted(() => vi.fn());
const companyEditForm = vi.hoisted(() => vi.fn(() => <form>düzenle</form>));
const companyLogoForms = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/company/company", () => ({ getCompany }));
vi.mock("@/components/company/company-edit-form", () => ({ CompanyEditForm: companyEditForm }));
vi.mock("@/components/company/company-logo-forms", () => ({ CompanyLogoForms: companyLogoForms }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("şirket düzenleme paneli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("şirket okunurken biten oturumun yönlendirmesini hata kartına dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect(
      `/giris?next=%2Fisveren%2Fsirket%2F${companyId}%2Fduzenle`,
    );
    getCompany.mockRejectedValue(interrupt);

    await expect(EditPanel({ companyId })).rejects.toBe(interrupt);
  });

  it("backend arızasında koddan seçilmiş Türkçe hata gösterir, formu çizmez", async () => {
    getCompany.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    render(await EditPanel({ companyId }));

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("ham mesaj")).toBeNull();
    expect(companyEditForm).not.toHaveBeenCalled();
  });

  it("bilinmeyen hatada nötr Türkçe yedeği gösterir", async () => {
    getCompany.mockRejectedValue(new Error("ağ koptu"));

    render(await EditPanel({ companyId }));

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });
});
