import type { JobDetail } from "@/jobs/contract";

/**
 * İlan ayrıntısının test fikstürleri.
 *
 * Tek yerde duruyor çünkü `JobDetail` bir gizlilik sınırı: tipe yeni bir alan
 * girdiğinde onu **her** iddianın görmesi gerekiyor. Üç dosyaya kopyalanmış
 * bir nesne, bir alan eklendiğinde yalnız birinde güncellenir ve öbür iki
 * test o alanı hiç ölçmeden yeşil kalır.
 */
export const jobDetailId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

/**
 * Ekranın modeli. Varsayılan ilan bireysel bir işverenin açık ilanı; şirket,
 * kapalı ilan ve `EXACT` adres gibi dallar üst yazımla kuruluyor.
 */
export function jobDetailFixture(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: jobDetailId,
    title: "Etkinlik görevlisi",
    description: "Festival alanında misafirleri karşıla.",
    duties: "Bilet kontrolü ve yönlendirme",
    dressCode: "Siyah kıyafet",
    categoryName: "Etkinlik",
    companyName: null,
    companyLogoUrl: null,
    employerName: "Ayşe Yıldız",
    type: "ONE_TIME",
    salaryType: "DAILY",
    startsAt: "2026-09-12T09:00:00",
    endsAt: "2026-09-12T18:00:00",
    createdAt: "2026-08-30T07:15:00Z",
    pricing: {
      pricingVersion: "v1",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "93.75",
      employerTotal: "1343.75",
    },
    minAge: 18,
    maxAge: 45,
    insuranceRequired: true,
    experienceRequired: false,
    headcount: 4,
    hiredCount: 1,
    images: [],
    cityName: "İstanbul",
    districtName: "Kadıköy",
    addressPrecision: "APPROXIMATE",
    status: "OPEN",
    ...overrides,
  };
}

/**
 * `GET /jobs/{jobId}` yanıtının **maskelenmemiş** hâli.
 *
 * Adres nesnesi eksiksiz — sokak, bina, kat, daire, posta kodu ve tam
 * hassasiyetli koordinat — ve `addressPrecision` `EXACT`. Bu uydurma bir
 * senaryo değil, sunucunun bugünkü davranışı:
 * `JobAddressVisibility.precision()` `publicCompanyAddress` ilanlarında bakan
 * kişiye hiç bakmadan `EXACT` diyor ve `protect()` yalnız `APPROXIMATE`
 * dalında maskeliyor, yani anonim bir ziyaretçi tam olarak bu gövdeyi
 * alabiliyor (is-koala/koala-backend#7, ADR-0003).
 *
 * İddiaları `APPROXIMATE` bir gövdeyle kurmak sızdıran dalı hiç
 * çalıştırmamak olurdu: orada backend zaten temizlenmiş bir yanıt gönderiyor
 * ve istemcinin `displayAddress`'i taşıyıp taşımadığı görünmüyor.
 */
export function jobDetailDto(overrides: Record<string, unknown> = {}) {
  return {
    id: jobDetailId,
    title: "Etkinlik görevlisi",
    description: "Festival alanında misafir karşılama.",
    duties: "Bilet kontrolü ve yönlendirme",
    dressCode: "Siyah kıyafet",
    position: "Karşılama",
    category: { id: "category-1", name: "Etkinlik", code: "EVENT" },
    employerType: "COMPANY",
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: 1500,
    pricing: {
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.20",
      serviceFeeAmount: "250.00",
      employerTotal: "1500.00",
    },
    minAge: 18,
    maxAge: 45,
    insuranceRequired: true,
    experienceRequired: false,
    startDateTime: "2026-09-12T09:00:00",
    endDateTime: "2026-09-12T18:00:00",
    createdAt: "2026-08-30T07:15:00Z",
    status: "OPEN",
    address: exactAddressDto(),
    addressPrecision: "EXACT",
    creator: { firstName: "Ayşe", lastName: "Yıldız" },
    company: { name: "Koala Etkinlik", logoUrl: "https://cdn.example.test/logo.png" },
    images: [
      { id: "image-1", url: "https://cdn.example.test/kapak.jpg", cover: true, caption: "Sahne" },
    ],
    headcount: 4,
    hiredCount: 1,
    ...overrides,
  };
}

function exactAddressDto() {
  return {
    id: "a1b2c3d4-0000-0000-0000-000000000000",
    countryName: "Türkiye",
    countryCode: "TR",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    components: {
      neighborhood: "Caferağa",
      thoroughfare: "Bağdat Caddesi",
      siteName: "Yıldız Sitesi",
      block: "B Blok",
      buildingName: "Yıldız Apartmanı",
      buildingNumber: "231",
      floor: "4",
      unitNumber: "12",
      postalCode: "34728",
      additionalDirections: "Kapıdan girince sağda",
    },
    position: { latitude: 40.9812345, longitude: 29.0621987, source: "GEOCODER" },
    displayAddress: "Bağdat Caddesi No: 231 Kat 4 Daire 12, Caferağa, Kadıköy, İstanbul",
  };
}

/**
 * `jobDetailDto`'nun tarayıcıya, DOM'a ya da yapısal veriye asla çıkmaması
 * gereken parçaları.
 *
 * Tek haneli `floor` ve `unitNumber` listede yok: "4" ve "12" fiyat, kontenjan
 * ve tarih metinlerinde de geçtiği için iddiayı yanlış sebeple kırmızıya
 * çevirirlerdi. Bina numarası, posta kodu ve koordinat yeterince ayırt edici.
 */
export const forbiddenAddressValues = [
  "Bağdat Caddesi",
  "Yıldız Sitesi",
  "Yıldız Apartmanı",
  "B Blok",
  "Caferağa",
  "231",
  "34728",
  "Kapıdan girince sağda",
  "40.9812345",
  "29.0621987",
  "GEOCODER",
] as const;
