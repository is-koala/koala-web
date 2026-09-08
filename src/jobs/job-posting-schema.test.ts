import { describe, expect, it } from "vitest";

import { jobDetailFixture } from "../../tests/support/job-detail";

import { jobPostingJsonLd } from "./job-posting-schema";

const canonical = "https://iskoala.com/is-ilanlari/9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

describe("JobPosting yapısal verisi", () => {
  it("yayındaki ilanı schema.org alanlarına çevirir", () => {
    const jsonLd = jobPostingJsonLd(jobDetailFixture(), canonical);

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Etkinlik görevlisi",
      url: canonical,
      description: "Festival alanında misafirleri karşıla.",
      datePosted: "2026-08-30T07:15:00Z",
      validThrough: "2026-09-12T18:00:00+03:00",
      employmentType: "TEMPORARY",
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Kadıköy",
          addressRegion: "İstanbul",
          addressCountry: "TR",
        },
      },
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "TRY",
        value: { "@type": "QuantitativeValue", value: "1250.00", unitText: "DAY" },
      },
      totalJobOpenings: 4,
    });
  });

  it.each(["CLOSED", "CANCELLED", "COMPLETED", "IN_PROGRESS", "UNKNOWN"] as const)(
    "%s durumundaki ilan için hiç yapısal veri üretmez",
    (status) => {
      // Google süresi geçmiş ilan sayfalarını cezalandırıyor. `UNKNOWN` de
      // listede: okunamayan bir durumu "açık" saymak o cezayı sessizce davet
      // ederdi.
      expect(jobPostingJsonLd(jobDetailFixture({ status }), canonical)).toBeNull();
    },
  );

  it("bireysel işverende hiringOrganization yazmaz", () => {
    /*
     * `creator` gerçek bir kişi; adını `hiringOrganization` altına yazmak onu
     * yapısal veri olarak indekslenebilir hâle getirirdi. Fikstürde
     * `employerName` dolu, yani alan gerçekten mevcut olmasına rağmen
     * düşürülüyor.
     */
    const jsonLd = jobPostingJsonLd(jobDetailFixture(), canonical);

    expect(jsonLd).not.toHaveProperty("hiringOrganization");
    expect(JSON.stringify(jsonLd)).not.toContain("Ayşe");
  });

  it("şirket ilanında hiringOrganization'ı logosuyla yazar", () => {
    const jsonLd = jobPostingJsonLd(
      jobDetailFixture({
        companyName: "Koala Etkinlik",
        companyLogoUrl: "https://cdn.example.com/logo.png",
      }),
      canonical,
    );

    expect(jsonLd?.hiringOrganization).toEqual({
      "@type": "Organization",
      name: "Koala Etkinlik",
      logo: "https://cdn.example.com/logo.png",
    });
  });

  it("ücret olarak çalışanın kazancını yazar, işveren toplamını değil", () => {
    // ADR-0002: hizmet bedeli çalışan ödemesinin üstüne ekleniyor, yani
    // `employerTotal` iş arayanın alacağından büyük. Yapısal veriye onu
    // yazmak ilanı olduğundan yüksek ücretli gösterirdi.
    const jsonLd = jobPostingJsonLd(jobDetailFixture(), canonical);

    expect(JSON.stringify(jsonLd)).toContain("1250.00");
    expect(JSON.stringify(jsonLd)).not.toContain("1343.75");
    expect(JSON.stringify(jsonLd)).not.toContain("93.75");
  });

  it("saatlik ilanda birim HOUR olur", () => {
    const jsonLd = jobPostingJsonLd(jobDetailFixture({ salaryType: "HOURLY" }), canonical);

    expect(jsonLd?.baseSalary).toMatchObject({
      value: { unitText: "HOUR" },
    });
  });

  it("okunamayan ücret türünde baseSalary'yi hiç yazmaz", () => {
    // Yanlış birim, günlük ücreti saatlik gibi göstererek ilanı olduğundan
    // çok daha cazip yazardı.
    const jsonLd = jobPostingJsonLd(jobDetailFixture({ salaryType: "UNKNOWN" }), canonical);

    expect(jsonLd).not.toHaveProperty("baseSalary");
  });

  it("fiyat anlık görüntüsü olmayan ilanda baseSalary yazmaz", () => {
    expect(jobPostingJsonLd(jobDetailFixture({ pricing: null }), canonical)).not.toHaveProperty(
      "baseSalary",
    );
  });

  it("tekrar eden ilanı PART_TIME, okunamayan türü hiç yazmaz", () => {
    expect(jobPostingJsonLd(jobDetailFixture({ type: "RECURRING" }), canonical)).toMatchObject({
      employmentType: "PART_TIME",
    });
    expect(jobPostingJsonLd(jobDetailFixture({ type: "UNKNOWN" }), canonical)).not.toHaveProperty(
      "employmentType",
    );
  });

  it("bitiş tarihine Türkiye ofsetini ekler; ofsetsiz değer yazmaz", () => {
    /*
     * `endDateTime` ofsetsiz `LocalDateTime` geliyor. Ofset yazılmazsa
     * `validThrough`'u okuyan taraf onu kendi saat diliminde yorumlar ve
     * ilanın son geçerlilik anı ülkeden ülkeye kayar.
     */
    const jsonLd = jobPostingJsonLd(jobDetailFixture(), canonical);

    expect(jsonLd?.validThrough).toBe("2026-09-12T18:00:00+03:00");
  });

  it("okunamayan bitiş tarihinde validThrough yazmaz", () => {
    expect(jobPostingJsonLd(jobDetailFixture({ endsAt: "" }), canonical)).not.toHaveProperty(
      "validThrough",
    );
  });

  it("konum alanı olmayan ilanda jobLocation yazmaz", () => {
    // Boş bir `PostalAddress` yazmak, ilanın Türkiye'nin herhangi bir yerinde
    // olduğunu iddia etmek olurdu.
    expect(
      jobPostingJsonLd(jobDetailFixture({ cityName: null, districtName: null }), canonical),
    ).not.toHaveProperty("jobLocation");
  });

  it("kontenjanı olmayan ilanda totalJobOpenings yazmaz", () => {
    expect(
      jobPostingJsonLd(jobDetailFixture({ headcount: null }), canonical),
    ).not.toHaveProperty("totalJobOpenings");
  });
});
