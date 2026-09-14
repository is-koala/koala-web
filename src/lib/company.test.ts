import { describe, expect, it } from "vitest";

import {
  companyCreateBody,
  companyDraftErrors,
  companySectionDestination,
  companyTextLimit,
  companyTypeLabel,
  companyTypes,
  companyUpdateBody,
  createCompanyFields,
  editableCompanyFields,
  emptyCompanyDraft,
  lockedCompanyFields,
  companyAddressApplied,
  type CompanyDraft,
} from "./company";

import type { AddressWrite } from "@/address/contract";

const address: AddressWrite = {
  countryId: "11111111-1111-4111-8111-111111111111",
  cityId: "22222222-2222-4222-8222-222222222222",
  districtId: "33333333-3333-4333-8333-333333333333",
  components: { neighborhood: "Kaptanpaşa", thoroughfare: "Piyalepaşa", postalCode: "34440" },
  position: { latitude: 41.05, longitude: 28.98, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-kaniti",
};

const filled: CompanyDraft = {
  name: "Koala Temizlik",
  email: "bilgi@koala.test",
  phoneNumber: "05001112233",
  website: "https://koala.test",
  description: "Kurumsal temizlik hizmetleri.",
  taxNumber: "1234567890",
  type: "LIMITED",
};

describe("şirket türü", () => {
  it("backend enum'unun sekiz değerini de taşır", () => {
    // `CompanyType.java` sekiz değer tanımlıyor; eksik bir değer kullanıcıyı
    // kendi şirketini anlatamaz hâlde bırakır ve seçtiği tür bir daha
    // değiştirilemez (`UpdateCompanyRequestDto` `type` taşımıyor).
    expect(companyTypes.map((option) => option.value)).toEqual([
      "SOLE_PROPRIETORSHIP",
      "LIMITED",
      "CORPORATION",
      "NON_PROFIT",
      "GOVERNMENT",
      "STARTUP",
      "AGENCY",
      "OTHER",
    ]);
  });

  it("tanımadığı değeri ham hâliyle bırakır", () => {
    // Uydurulmuş bir etiket, sözleşmenin değiştiğini ekrandan gizlerdi.
    expect(companyTypeLabel("LIMITED")).toBe("Limited şirket");
    expect(companyTypeLabel("HOLDING")).toBe("HOLDING");
  });
});

describe("şirket formu doğrulaması", () => {
  it("zorunlu alanların hepsini boş taslakta bildirir", () => {
    expect(companyDraftErrors(emptyCompanyDraft, createCompanyFields)).toEqual({
      name: "Şirket adı zorunlu.",
      email: "Şirket e-postası zorunlu.",
      phoneNumber: "Telefon numarası zorunlu.",
      taxNumber: "Vergi numarası zorunlu.",
      type: "Şirket türü zorunlu.",
    });
  });

  it("düzenlemede yalnız beş alanı denetler", () => {
    // `PATCH /companies/{companyId}` yalnız bu beşini taşıyor; vergi
    // numarasını ve türü boş bulup hata yazmak, kullanıcıya kapatamayacağı
    // bir eksik gösterirdi.
    expect(companyDraftErrors(emptyCompanyDraft, editableCompanyFields)).toEqual({
      name: "Şirket adı zorunlu.",
      email: "Şirket e-postası zorunlu.",
      phoneNumber: "Telefon numarası zorunlu.",
    });
  });

  it("geçerli taslakta hiçbir alan hatası üretmez", () => {
    expect(companyDraftErrors(filled, createCompanyFields)).toEqual({});
  });

  it("e-posta biçimini gönderimden önce yakalar", () => {
    expect(companyDraftErrors({ ...filled, email: "koala.test" }, createCompanyFields)).toEqual({
      email: "Geçerli bir e-posta adresi yaz.",
    });
  });

  it("her metin alanını sütunun gerçek genişliğinde keser", () => {
    // Sınır sabitten değil **şemadan** yazılıyor: `companies` tablosunda altı
    // metin sütunu da `VARCHAR(255)`
    // (`db/changelog/2025/08/20-01-changelog.xml:66-72`), ama
    // `UpdateCompanyRequestDto` website'a 512, açıklamaya 4000 izin veriyor.
    // Beklentiyi `companyTextLimit` üzerinden kurmak, sabit DTO'nun gevşek
    // değerine kaydırıldığında da geçerdi — ve o kayma doğrulamadan geçip
    // veritabanında patlayan, `errorCode` taşımayan bir 500 üretir.
    expect(companyTextLimit).toBe(255);

    const tooLong = "a".repeat(256);
    expect(companyDraftErrors({ ...filled, description: tooLong }, createCompanyFields)).toEqual({
      description: "En fazla 255 karakter olabilir.",
    });
    expect(companyDraftErrors({ ...filled, website: tooLong }, createCompanyFields)).toEqual({
      website: "En fazla 255 karakter olabilir.",
    });
    expect(companyDraftErrors({ ...filled, description: "a".repeat(255) }, createCompanyFields)).toEqual({});
  });

  it("vergi numarasına biçim kuralı koymaz, yalnız boş bırakılmasını engeller", () => {
    // Backend `taxNumber` üzerinde hiçbir biçim doğrulaması yapmıyor
    // (`CreateCompanyRequestDto` yalnız `@NotBlank`) ve alan kurulduktan
    // sonra değiştirilemiyor. İstemcide uydurulmuş bir kalıp, sunucunun
    // kabul edeceği geçerli bir numarayı geri çevirebilirdi.
    expect(companyDraftErrors({ ...filled, taxNumber: "TR-123/456" }, createCompanyFields)).toEqual({});
    expect(companyDraftErrors({ ...filled, taxNumber: "   " }, createCompanyFields)).toEqual({
      taxNumber: "Vergi numarası zorunlu.",
    });
  });

  it("sözleşmede olmayan bir türü reddeder", () => {
    expect(companyDraftErrors({ ...filled, type: "HOLDING" }, createCompanyFields)).toEqual({
      type: "Listedeki şirket türlerinden birini seç.",
    });
  });
});

describe("oluşturma gövdesi", () => {
  it("adresi olduğu gibi taşır ve boş bırakılan alanları hiç göndermez", () => {
    // `CreateCompanyRequestDto` boş dizeyi kayıt sayar; opsiyonel alanı boş
    // göndermek, kullanıcının hiç doldurmadığı bir web adresini şirket
    // profiline yazardı.
    const body = companyCreateBody({ ...filled, website: "", description: " " }, address);

    expect(body).toEqual({
      name: "Koala Temizlik",
      email: "bilgi@koala.test",
      phoneNumber: "05001112233",
      taxNumber: "1234567890",
      type: "LIMITED",
      address,
    });
  });

  it("geçersiz taslakta gövde üretmez", () => {
    expect(companyCreateBody({ ...filled, name: "" }, address)).toBeNull();
  });

  it("adres onaylanmadan gövde üretmez", () => {
    // `POST /companies` geçerli bir `AddressWriteV2` olmadan hiç çağrılamaz.
    expect(companyCreateBody(filled, null)).toBeNull();
  });
});

describe("güncelleme gövdesi", () => {
  it("yalnız beş alanı taşır", () => {
    // `taxNumber`, `type` ve `address` kurulduktan sonra değiştirilemiyor;
    // gövdeye konsalardı backend onları sessizce yok sayar ve ekran
    // değişmemiş bir alanı değişmiş gibi gösterirdi.
    expect(companyUpdateBody(filled)).toEqual({
      name: "Koala Temizlik",
      email: "bilgi@koala.test",
      phoneNumber: "05001112233",
      website: "https://koala.test",
      description: "Kurumsal temizlik hizmetleri.",
    });
  });

  it("temizlenen opsiyonel alanı boş dize olarak gönderir", () => {
    // `updateCompany` yalnız `null` olmayan alanları uyguluyor
    // (`CompanyManager.java:281-300`): alanı gövdeden çıkarmak, kullanıcının
    // sildiği web adresini eski hâliyle bırakırdı.
    expect(companyUpdateBody({ ...filled, website: "  ", description: "" })).toMatchObject({
      website: "",
      description: "",
    });
  });
});

describe("şirket bölümünün girişi", () => {
  it("hiç üyelik yokken kullanıcıyı oluşturmaya bırakır", () => {
    expect(companySectionDestination([])).toEqual({ kind: "create" });
  });

  it("tek şirkette doğrudan o şirketin profiline gider", () => {
    // Ara bir seçim ekranı, tek seçeneği olan kullanıcıya her girişte
    // gereksiz bir tıklama ekler.
    expect(companySectionDestination([{ companyId: "sirket-1" }])).toEqual({
      kind: "single",
      companyId: "sirket-1",
    });
  });

  it("birden çok şirkette seçtirir", () => {
    // Backend ikinci şirket açmayı hiçbir yerde engellemiyor; ekranlar tekil
    // şirket varsayarsa ikinci şirket adres çubuğundan başka hiçbir yerden
    // görünmez olurdu.
    expect(
      companySectionDestination([{ companyId: "sirket-1" }, { companyId: "sirket-2" }]),
    ).toEqual({ kind: "choose" });
  });
});

describe("kilitli alanlar", () => {
  it("değiştirilemeyen iki alanı gerekçesiyle birlikte sayar", () => {
    // Ekran "neden düzenleyemiyorum" sorusunu cevapsız bırakmamalı; gerekçe
    // alanın yanında duruyor ve tek yerden okunuyor. Adres listede değil:
    // `PATCH /companies/{id}` 0.9.24'ten beri `address` taşıyor (#172).
    expect(lockedCompanyFields.map((field) => field.name)).toEqual(["taxNumber", "type"]);
    for (const field of lockedCompanyFields) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.reason.length).toBeGreaterThan(0);
    }
  });

  it("düzenlenebilir alanlarla kilitli alanlar kesişmez", () => {
    const editable = new Set<string>(editableCompanyFields);
    for (const field of lockedCompanyFields) {
      expect(editable.has(field.name), field.name).toBe(false);
    }
  });
});

describe("adres yazmasının uygulandığı kararı", () => {
  const sent = {
    countryId: "c",
    cityId: "i",
    districtId: "d",
    components: {},
    position: { latitude: 41.0812345, longitude: 29.0087654, source: "USER_CONFIRMED_PIN" as const },
  };

  it("yanıttaki konum gönderilenle altı ondalıkta eşleşiyorsa uygulanmış sayar", () => {
    expect(
      companyAddressApplied(sent, { position: { latitude: 41.081235, longitude: 29.008765 } }),
    ).toBe(true);
  });

  it("eski sunucunun eski konumu geri vermesini uygulanmadı sayar", () => {
    // Spring varsayılanı bilinmeyen `address` alanını sessizce düşürüyor ve
    // 200 ile eski adresi döndürüyor; 400 gelmiyor. Tek gösterge konum.
    expect(
      companyAddressApplied(sent, { position: { latitude: 41.0, longitude: 28.9 } }),
    ).toBe(false);
    expect(companyAddressApplied(sent, null)).toBe(false);
  });

  it("konum taşımayan yanıtta karar veremez ve uygulanmış sayar", () => {
    expect(companyAddressApplied(sent, { position: null })).toBe(true);
  });
});
