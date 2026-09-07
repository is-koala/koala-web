import { describe, expect, it } from "vitest";

import type { AddressWrite } from "@/address/contract";

import {
  emptyJobDraft,
  addressFieldErrors,
  companyJobBody,
  companyJobErrors,
  deserializeDraft,
  individualJobBody,
  individualJobErrors,
  insuranceLocked,
  insuranceRequiredFor,
  quotedWorkerPayout,
  serializeDraft,
  unmatchedFieldMessages,
  withJobFieldAliases,
  type JobDraft,
} from "./job-posting";

const address: AddressWrite = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    postalCode: "34330",
  },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-token-yer-tutucu",
};

const category = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f01",
  name: "Garson",
  code: "WAITER",
  requiresInsurance: false,
};

const insured = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f02",
  name: "Motorlu kurye",
  code: "COURIER",
  requiresInsurance: true,
};

function draft(overrides: Partial<JobDraft> = {}): JobDraft {
  return {
    ...emptyJobDraft,
    categoryId: category.id,
    title: "Hafta sonu garson",
    description: "İki günlük etkinlikte servis desteği.",
    position: "Garson",
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: "1500",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    minAge: "18",
    maxAge: "45",
    experienceRequired: "false",
    ...overrides,
  };
}

describe("bireysel ilan taslağının doğrulaması", () => {
  it("eksiksiz taslakta hiçbir hata bulmaz", () => {
    expect(individualJobErrors(draft(), [category])).toEqual({});
  });

  it("yaş aralığı ters çevrildiğinde hatayı maxAge alanına yazar", () => {
    // Sunucu bu kuralı `ageRangeOrdered` adıyla bildiriyor ve o ad hiçbir
    // input'a karşılık gelmiyor; istemci onu doğru alana yazmak zorunda.
    expect(individualJobErrors(draft({ minAge: "40", maxAge: "20" }), [category])).toHaveProperty(
      "maxAge",
    );
  });

  it("bitiş tarihi başlangıçtan önce ya da ona eşitse gönderilmesine izin vermez", () => {
    // Backend'de bu kural yok (`CreateIndividualJobDto` yalnız yaş sırasını
    // denetliyor); tek savunma istemci.
    expect(
      individualJobErrors(draft({ endDateTime: "2026-10-09T09:00" }), [category]),
    ).toHaveProperty("endDateTime");
    expect(
      individualJobErrors(draft({ endDateTime: "2026-10-10T09:00" }), [category]),
    ).toHaveProperty("endDateTime");
  });

  it("sigorta zorunlu kategoriyi bireysel ilanda kabul etmez", () => {
    expect(individualJobErrors(draft({ categoryId: insured.id }), [category, insured])).toHaveProperty(
      "categoryId",
    );
  });

  it("kişi sayısı boş bırakılabilir ama sıfır olamaz", () => {
    expect(individualJobErrors(draft({ headcount: "" }), [category])).toEqual({});
    expect(individualJobErrors(draft({ headcount: "0" }), [category])).toHaveProperty("headcount");
  });

  it("ücret birden küçük olamaz", () => {
    expect(individualJobErrors(draft({ salary: "0.5" }), [category])).toHaveProperty("salary");
  });

  it("başlık, açıklama ve pozisyon boş bırakılamaz", () => {
    const errors = individualJobErrors(
      draft({ title: "  ", description: "", position: "" }),
      [category],
    );

    expect(Object.keys(errors).sort()).toEqual(["description", "position", "title"]);
  });
});

describe("bireysel ilan gövdesi", () => {
  it("adres gövdesini kanonik bileşenden geldiği gibi taşır", () => {
    // `AddressWriteDto` bilinmeyen alanı `REQUEST_MALFORMED` ile reddediyor:
    // formun adrese eklediği tek bir alan bütün gönderimi çöpe atardı.
    const body = individualJobBody(draft(), address, [category]);

    expect(body?.address).toEqual(address);
  });

  it("sigorta ve 'adresi herkese göster' alanlarını hiç göndermez", () => {
    // İkisi de `CreateIndividualJobDto`'da yok ve sunucu ikisini de sabitliyor
    // (`JobManager.java:153,155`).
    const body = individualJobBody(draft(), address, [category]);

    expect(body).not.toHaveProperty("insuranceRequired");
    expect(body).not.toHaveProperty("addressPublic");
  });

  it("boş bırakılan isteğe bağlı alanları gövdeye koymaz", () => {
    const body = individualJobBody(draft({ headcount: "", sector: "", duties: "" }), address, [
      category,
    ]);

    expect(body).not.toHaveProperty("headcount");
    expect(body).not.toHaveProperty("sector");
    expect(body).not.toHaveProperty("duties");
  });

  it("sayı ve mantık alanlarını DTO tiplerine çevirir, ücreti ondalık dize bırakır", () => {
    const body = individualJobBody(
      draft({ salary: "1500.50", headcount: "3", experienceRequired: "true" }),
      address,
      [category],
    );

    expect(body).toMatchObject({
      minAge: 18,
      maxAge: 45,
      headcount: 3,
      experienceRequired: true,
      // Para `BigDecimal`, ölçek 2 (koala-backend CLAUDE.md §2e): kayan
      // noktaya çevirip geri yazmak kuruş kaybettirebilir.
      salary: "1500.50",
    });
  });

  it("geçersiz taslakta gövde üretmez", () => {
    expect(individualJobBody(draft({ maxAge: "10" }), address, [category])).toBeNull();
  });

  it("adres onaylanmadan gövde üretmez", () => {
    expect(individualJobBody(draft(), null, [category])).toBeNull();
  });

  it("fiyat önizlemesine giden tutar, ilana giden ücretin aynısıdır", () => {
    // `pricingService.snapshot(job)` kilidi `job.getSalary()` üzerinden
    // kuruyor: önizlemede başka bir tutar sorulursa kullanıcı yayımlarken
    // gördüğünden farklı bir fiyata razı olmuş olur.
    const filled = draft({ salary: "1500.50" });

    expect(quotedWorkerPayout(filled)).toBe(individualJobBody(filled, address, [category])?.salary);
  });
});

describe("sunucu alan hatalarının forma taşınması", () => {
  it("`ageRangeOrdered` mesajını maxAge alanına taşır", () => {
    // `@AssertTrue public boolean isAgeRangeOrdered()` alan adını
    // `ageRangeOrdered` yapıyor; hiçbir input o adı taşımadığı için
    // eşleme kurulmazsa mesaj ekranda hiç görünmez.
    expect(withJobFieldAliases({ ageRangeOrdered: "En büyük yaş küçük olamaz" })).toEqual({
      maxAge: "En büyük yaş küçük olamaz",
    });
  });

  it("alanın kendi mesajı varsa takma addan gelen onu ezmez", () => {
    expect(
      withJobFieldAliases({ ageRangeOrdered: "takma", maxAge: "kendi" }),
    ).toEqual({ maxAge: "kendi" });
  });

  it("adres alanlarının iç içe yolunu kırpıp adres bileşenine verir", () => {
    expect(
      addressFieldErrors({
        "address.components.postalCode": "Posta kodu 5 haneli olmalı",
        "address.countryId": "Ülke bulunamadı",
        title: "Başlık zorunlu",
      }),
    ).toEqual({ postalCode: "Posta kodu 5 haneli olmalı", countryId: "Ülke bulunamadı" });
  });

  it("hiçbir input'a karşılık gelmeyen mesajları üst banda çıkarır", () => {
    // Eşleşmeyen ad sessizce düşerse backend'in söylediği şey ekranda hiç
    // görünmez; kullanıcı reddi görür, sebebini göremez.
    expect(
      unmatchedFieldMessages({
        title: "alanın altında görünür",
        bilinmeyenAlan: "üst bantta görünmeli",
      }),
    ).toEqual(["üst bantta görünmeli"]);
  });
});

describe("taslağın tarayıcıda saklanması", () => {
  it("adres kanıtını hiç saklamaz", () => {
    // Süresi dolmuş bir `candidateToken` kaydedilmiş forma yapışırsa
    // kullanıcı çözemeyeceği bir 400 görür (`AddressSearchManager:199-221`,
    // aday kanıtı 10 dk yaşıyor).
    const stored = JSON.parse(serializeDraft(draft())) as Record<string, unknown>;

    expect(stored).not.toHaveProperty("address");
    expect(stored).not.toHaveProperty("candidateToken");
    expect(JSON.stringify(stored)).not.toContain("candidateToken");
  });

  it("yazdığı alanları geri okur", () => {
    expect(deserializeDraft(serializeDraft(draft()))).toEqual(draft());
  });

  it("tanımadığı alanları geri okurken düşürür", () => {
    // Beyaz liste: eski bir sürümün ya da elle kurcalanmış bir kaydın
    // taşıdığı alanlar taslağa sızmaz.
    const restored = deserializeDraft(
      JSON.stringify({ title: "kalır", candidateToken: "düşer", address: { cityId: "düşer" } }),
    );

    expect(restored).toEqual({ ...emptyJobDraft, title: "kalır" });
  });

  it("okunamayan kayıtta boş taslağa döner", () => {
    expect(deserializeDraft("{bozuk")).toEqual(emptyJobDraft);
    expect(deserializeDraft(null)).toEqual(emptyJobDraft);
  });
});

describe("şirket ilanının doğrulaması", () => {
  it("sigorta zorunlu kategoriyi kabul eder", () => {
    // Bireysel yolun tek farkı: `JobManager.createCorporateJob` bu kategoriyi
    // reddetmiyor, yalnız `insuranceRequired=true` istiyor.
    expect(companyJobErrors(draft({ categoryId: insured.id }), [category, insured])).toEqual({});
  });

  it("ortak alan kurallarını bireysel ilanla aynı okur", () => {
    expect(companyJobErrors(draft({ minAge: "40", maxAge: "20" }), [category])).toHaveProperty(
      "maxAge",
    );
    expect(companyJobErrors(draft({ salary: "0.5" }), [category])).toHaveProperty("salary");
    expect(
      companyJobErrors(draft({ endDateTime: "2026-10-09T09:00" }), [category]),
    ).toHaveProperty("endDateTime");
  });
});

describe("şirket ilanının sigorta değeri", () => {
  it("kategori sigorta zorunlu kılıyorsa işverenin tercihine bakmaz", () => {
    // `JobManager.java:201-204` bu ilanı `insuranceRequired=false` ile 400'e
    // düşürüyor; anahtarın kapalı kalabilmesi kullanıcıyı formu doldurup en
    // sonda reddedilmeye bırakırdı (koala-mobile#24).
    expect(insuranceRequiredFor([category, insured], insured.id, "false")).toBe(true);
    expect(insuranceRequiredFor([category, insured], insured.id, "")).toBe(true);
  });

  it("kategori zorunlu kılmıyorsa işverenin kendi tercihini taşır", () => {
    expect(insuranceRequiredFor([category, insured], category.id, "true")).toBe(true);
    expect(insuranceRequiredFor([category, insured], category.id, "false")).toBe(false);
  });

  it("değeri saklanan bir alandan değil seçili kategoriden okur", () => {
    // Tek değişen kategori: taslakta senkron tutulan bir alan olsaydı aynı
    // taslak iki kategoride de aynı cevabı verirdi — hatayı doğuran tam
    // olarak oydu.
    const stale = draft({ insurancePreference: "false" });

    expect(insuranceRequiredFor([category, insured], stale.categoryId, stale.insurancePreference))
      .toBe(false);
    expect(insuranceRequiredFor([category, insured], insured.id, stale.insurancePreference))
      .toBe(true);
  });

  it("katalog okunamadığında sigortayı kendiliğinden açmaz", () => {
    // `null` "okunamadı" demek: bilinmeyeni sigortalıya çevirmek, işverenin
    // hiç kabul etmediği bir yükümlülüğü ilana yazardı. Son söz backend'in.
    expect(insuranceRequiredFor(null, insured.id, "false")).toBe(false);
  });

  it("kilidi de aynı kategoriden okur", () => {
    expect(insuranceLocked([category, insured], insured.id)).toBe(true);
    expect(insuranceLocked([category, insured], category.id)).toBe(false);
    expect(insuranceLocked(null, insured.id)).toBe(false);
  });
});

describe("şirket ilanı gövdesi", () => {
  it("sigorta alanını her zaman taşır", () => {
    // `CreateCompanyJobDto.insuranceRequired` `@NotNull`: alan hiç
    // gönderilmezse ilan alan doğrulamasına takılır.
    expect(companyJobBody(draft(), address, [category])).toHaveProperty(
      "insuranceRequired",
      false,
    );
  });

  it("sigorta zorunlu kategoride tercih kapalı bırakılsa da true gönderir", () => {
    const body = companyJobBody(
      draft({ categoryId: insured.id, insurancePreference: "false" }),
      address,
      [category, insured],
    );

    expect(body?.insuranceRequired).toBe(true);
  });

  it("'adresi herkese göster' alanını hiç göndermez", () => {
    // `CreateCompanyJobDto.addressPublic` var ama bir ürün kararı taşıyor ve
    // bu dilimde forma girmiyor; primitive `boolean` olduğu için alan
    // gelmediğinde sunucu `false` yazıyor.
    expect(companyJobBody(draft(), address, [category])).not.toHaveProperty("addressPublic");
  });

  it("adresi kanonik bileşenden geldiği gibi taşır", () => {
    expect(companyJobBody(draft(), address, [category])?.address).toEqual(address);
  });

  it("geçersiz taslakta ve onaylanmamış adreste gövde üretmez", () => {
    expect(companyJobBody(draft({ maxAge: "10" }), address, [category])).toBeNull();
    expect(companyJobBody(draft(), null, [category])).toBeNull();
  });

  it("fiyat önizlemesine giden tutar, ilana giden ücretin aynısıdır", () => {
    const filled = draft({ salary: "1500.50" });

    expect(quotedWorkerPayout(filled)).toBe(companyJobBody(filled, address, [category])?.salary);
  });
});
