import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Company } from "@/server/company/company";

import { CompanyProfileView } from "./company-profile";

const company: Company = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Koala Temizlik",
  email: "bilgi@koala.test",
  logoUrl: null,
  phoneNumber: "05001112233",
  website: "https://koala.test",
  description: "Kurumsal temizlik hizmetleri.",
  taxNumber: "1234567890",
  type: "LIMITED",
  address: {
    countryName: "Türkiye",
    cityName: "İstanbul",
    districtName: "Beşiktaş",
    components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", postalCode: "34330" },
    displayAddress: "Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul",
    needsReview: false,
  },
  contacts: [],
  followerCount: 12,
  approved: false,
};

function renderProfile(overrides: Partial<Company> = {}, viewerRole = "ADMIN") {
  render(
    <CompanyProfileView
      company={{ ...company, ...overrides }}
      viewerRole={viewerRole}
      editHref="/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/duzenle"
      addressHref="/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/adres"
      contactsHref="/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/yetkililer"
      galleryHref="/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/galeri"
      newJobHref="/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ilan/yeni"
    />,
  );
}

describe("şirket profili", () => {
  afterEach(cleanup);

  it("hangi şirkette olunduğunu başlıkta yazar", () => {
    // Kullanıcı iki şirketin yetkilisi olabilir; ad ekranda olmasa adres
    // çubuğundaki kimlikten hangi şirket olduğu okunamazdı.
    renderProfile();

    expect(screen.getByRole("heading", { level: 1, name: "Koala Temizlik" })).toBeInTheDocument();
  });

  it("onay bekleyen şirkette kapalı yolu ve bildirimin gelmeyeceğini yazar", () => {
    /*
     * `approveCompany` yalnız bayrağı çeviriyor ve hiçbir bildirim
     * göndermiyor (is-koala/koala-backend#62); ret ucu da yok. "Onaylandığında
     * haber vereceğiz" demek, hiç gelmeyecek bir e-postayı beklettirirdi.
     */
    renderProfile({ approved: false });

    expect(screen.getByText("Onay bekliyor")).toBeInTheDocument();
    expect(screen.getByText(/ilan açamazsın/i)).toBeInTheDocument();
    expect(screen.getByText(/bildirim gönderilmiyor/i)).toBeInTheDocument();
  });

  it("onaylanmış şirkette bekleme metnini hiç göstermez", () => {
    renderProfile({ approved: true });

    expect(screen.queryByText("Onay bekliyor")).not.toBeInTheDocument();
    expect(screen.getByText("Onaylandı")).toBeInTheDocument();
  });

  it("türü Türkçe karşılığıyla, vergi numarasını olduğu gibi gösterir", () => {
    renderProfile();

    expect(screen.getByText("Limited şirket")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("adresi salt okunur kanonik görünümle çizer", () => {
    renderProfile();

    expect(
      screen.getByText("Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul"),
    ).toBeInTheDocument();
  });

  it("takipçi sayısını ve yetkililer bağlantısını verir", () => {
    renderProfile();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Şirket yetkilileri" })).toHaveAttribute(
      "href",
      "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/yetkililer",
    );
    expect(screen.getByRole("link", { name: "Şirket galerisi" })).toHaveAttribute(
      "href",
      "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/galeri",
    );
  });

  it("düzenleme bağlantısını yalnız yöneticiye verir", () => {
    // `PATCH /companies/{companyId}` `requireCompanyAdmin` istiyor ve
    // geçemeyen çağrıya 404 dönüyor: `STAFF`'a bağlantı vermek onu kesin bir
    // hata ekranına yollardı.
    renderProfile({}, "ADMIN");
    expect(screen.getByRole("link", { name: "Şirket bilgilerini düzenle" })).toHaveAttribute(
      "href",
      "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/duzenle",
    );

    cleanup();
    renderProfile({}, "STAFF");
    expect(screen.queryByRole("link", { name: "Şirket bilgilerini düzenle" })).not.toBeInTheDocument();
  });

  it("adres düzenleme bağlantısını yalnız yöneticiye verir, yetkili salt okur", () => {
    // `PATCH /companies/{id}` `address` alanını da `requireCompanyAdmin`
    // arkasında alıyor (is-koala/koala-backend#288); CONTACT'a bağlantı
    // vermek onu 404'e yollardı. Adres bölümü ödeme kapısının hedefi
    // (`#sirket-adresi`), o yüzden her rolde çizilir.
    renderProfile({}, "ADMIN");
    const section = screen.getByRole("region", { name: "Şirket adresi" });
    expect(section).toHaveAttribute("id", "sirket-adresi");
    expect(within(section).getByRole("link", { name: "Düzenle" })).toHaveAttribute(
      "href",
      "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/adres",
    );

    cleanup();
    renderProfile({}, "CONTACT");
    const readOnly = screen.getByRole("region", { name: "Şirket adresi" });
    expect(within(readOnly).queryByRole("link", { name: "Düzenle" })).not.toBeInTheDocument();
    expect(
      within(readOnly).getByText("Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul"),
    ).toBeInTheDocument();
  });

  it("adres eklenmemiş şirkette de çizilir", () => {
    // `CompanyDto.address` her zaman dolu gelmiyor; `null` üzerinde
    // dallanmayan bir görünüm burada patlardı.
    renderProfile({ address: null });

    expect(screen.getByText("Adres eklenmemiş")).toBeInTheDocument();
  });
});

describe("şirket profilinden ilan açma", () => {
  afterEach(cleanup);

  it("onaylı şirkette ilan açma yolunu gösterir", () => {
    renderProfile({ approved: true });

    expect(screen.getByRole("link", { name: /Şirket adına ilan aç/ })).toHaveAttribute(
      "href",
      "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ilan/yeni",
    );
  });

  it("onay bekleyen şirkette ilan açma yolunu göstermez", () => {
    // Kural istemcide yaşıyor: `company.isApproved()` backend'in iş
    // mantığında hiç okunmuyor. Bağlantıyı burada göstermek, kullanıcıyı
    // formun başında kapanan bir kapıya yollardı.
    renderProfile({ approved: false });

    expect(screen.queryByRole("link", { name: /Şirket adına ilan aç/ })).toBeNull();
  });

  it("yetkili olan herkese gösterir, yalnız yöneticiye değil", () => {
    // İlan açmak `requireCompanyAdmin` istemiyor; `createCorporateJob` yalnız
    // yetkili listesinde olmayı arıyor.
    renderProfile({ approved: true }, "STAFF");

    expect(screen.getByRole("link", { name: /Şirket adına ilan aç/ })).toBeVisible();
  });
});
