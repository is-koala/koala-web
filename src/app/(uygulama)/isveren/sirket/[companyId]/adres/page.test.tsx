import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../../../tests/support/control-flow";

import Page, { AddressPanel } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getCompany = vi.hoisted(() => vi.fn());
const companyAddressForm = vi.hoisted(() =>
  vi.fn(({ profileHref }: { profileHref: string }) => <form data-profile={profileHref}>adres</form>),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/company/company", () => ({ getCompany }));
vi.mock("./company-address-form", () => ({ CompanyAddressForm: companyAddressForm }));
vi.mock("./actions", () => ({ saveCompanyAddressAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const company = {
  id: companyId,
  name: "Koala Temizlik",
  email: "bilgi@koala.test",
  logoUrl: null,
  phoneNumber: "05001112233",
  website: null,
  description: null,
  taxNumber: "1234567890",
  type: "LIMITED",
  address: {
    countryName: "Türkiye",
    cityName: "İstanbul",
    districtName: "Beşiktaş",
    components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", postalCode: "34330" },
    displayAddress: "Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul",
    needsReview: false,
    position: null,
  },
  contacts: [],
  followerCount: 0,
  approved: true,
};

function viewerWith(role: string | null) {
  return {
    viewer: {
      companies: role === null ? [] : [{ companyId, companyName: company.name, role, approved: true }],
    },
    failure: null,
  };
}

describe("şirket adresi sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompany.mockResolvedValue(company);
  });

  it("yöneticiye kayıtlı adresi ve formu çizer", async () => {
    enterShell.mockResolvedValue(viewerWith("ADMIN"));

    // Sayfa kapıyı geçiyor; panel bir Suspense sınırının içinde olduğu için
    // doğrudan çağrılıp çiziliyor.
    await expect(Page({ params: Promise.resolve({ companyId }) })).resolves.not.toBeNull();
    render(await AddressPanel({ companyId }));

    expect(screen.getByRole("heading", { level: 1, name: "Şirket adresini düzenle" })).toBeVisible();
    expect(
      screen.getByText("Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul"),
    ).toBeInTheDocument();
    expect(companyAddressForm).toHaveBeenCalledWith(
      expect.objectContaining({ profileHref: `/isveren/sirket/${companyId}` }),
      undefined,
    );
  });

  it("CONTACT'ı da üye olmayanı da aynı 404'e düşürür", async () => {
    // `PATCH /companies/{id}` `requireCompanyAdmin` geçemeyene 404 dönüyor;
    // ekranın "yetkin yok" demesi backend'in bilerek ayırt edilemez
    // bıraktığı iki durumu ayırırdı. CONTACT adresi profilde zaten okuyor.
    for (const role of ["CONTACT", "STAFF", null]) {
      enterShell.mockResolvedValue(viewerWith(role));

      await expect(Page({ params: Promise.resolve({ companyId }) })).rejects.toThrow(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
    }
    expect(getCompany).not.toHaveBeenCalled();
  });

  it("şirket okunurken biten oturumun yönlendirmesini hata kartına dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect(
      `/giris?next=%2Fisveren%2Fsirket%2F${companyId}%2Fadres`,
    );
    getCompany.mockRejectedValue(interrupt);

    await expect(AddressPanel({ companyId })).rejects.toBe(interrupt);
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

    render(await AddressPanel({ companyId }));

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("ham mesaj")).toBeNull();
    expect(companyAddressForm).not.toHaveBeenCalled();
  });
});
