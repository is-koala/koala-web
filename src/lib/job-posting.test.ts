import { describe, expect, it } from "vitest";

import type { AddressWrite } from "@/address/contract";

import {
  emptyJobDraft,
  addressFieldErrors,
  deserializeDraft,
  individualJobBody,
  individualJobErrors,
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
    const insured = { ...category, id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f02", requiresInsurance: true };

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
