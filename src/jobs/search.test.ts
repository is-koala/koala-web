import { describe, expect, it } from "vitest";

import {
  activeJobFilters,
  backendJobSearchParams,
  districtCityParamName,
  hasJobFilters,
  jobSearchParams,
  jobSortOptions,
  parseJobSearchParams,
  type JobFilterOptions,
  type JobSearchQuery,
} from "./search";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherCityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const districtId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** `JobManager.SORTABLE_FIELDS`; sunucu bunun dışındaki alanı 400 ile reddediyor. */
const sortableFields = ["createdAt", "salary", "startDateTime", "title"];

function backendParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  return backendJobSearchParams(parseJobSearchParams(raw));
}

describe("ilan arama parametrelerinin eşlenmesi", () => {
  it("Türkçe parametreleri sunucunun alan adlarına çevirir", () => {
    const params = backendParams({
      ara: "garson",
      kategori: categoryId,
      il: cityId,
      ilce: districtId,
      tur: "ONE_TIME",
    });

    expect(params.get("query")).toBe("garson");
    expect(params.get("categoryId")).toBe(categoryId);
    expect(params.get("cityId")).toBe(cityId);
    expect(params.get("districtId")).toBe(districtId);
    expect(params.get("type")).toBe("ONE_TIME");
  });

  it("tanımadığı parametreyi sunucuya hiç geçirmez", () => {
    // Bir arama motoru botu rastgele parametrelerle gelebiliyor; tanınmayan
    // bir alanı olduğu gibi iletmek sunucuya kontrolsüz girdi taşımak olurdu.
    const params = backendParams({ ara: "garson", sirket: "koala", size: "100", sort: "password" });

    expect([...params.keys()].toSorted()).toEqual(["page", "query", "size", "sort"]);
    expect(params.get("sort")).toBe("createdAt,desc");
  });

  it("UUID olmayan kategori, il ve ilçe değerlerini düşürür", () => {
    // Spring bu alanları `UUID`'ye bind ediyor: bozuk bir değer 400 üretir ve
    // ziyaretçinin düzeltemeyeceği bir hataya döner.
    const params = backendParams({ kategori: "garson", il: "34", ilce: "kadikoy" });

    expect(params.has("categoryId")).toBe(false);
    expect(params.has("cityId")).toBe(false);
    expect(params.has("districtId")).toBe(false);
  });

  it("enum'da olmayan ilan türünü düşürür", () => {
    expect(backendParams({ tur: "HAFTALIK" }).has("type")).toBe(false);
  });

  it("boşluktan ibaret aramayı sunucuya taşımaz", () => {
    expect(backendParams({ ara: "   " }).has("query")).toBe(false);
  });

  it("tekrarlanan bir parametreyi tek bir seçim saymaz", () => {
    const params = backendParams({ kategori: [categoryId, categoryId], ara: ["a", "b"] });

    expect(params.has("categoryId")).toBe(false);
    expect(params.has("query")).toBe(false);
  });
});

describe("sıralama", () => {
  it("her arayüz seçeneği sunucunun izin verdiği bir alana dayanır", () => {
    // `PageableSanitizer.rejectUnknownSort` tanımadığı alanı sessizce yok
    // saymıyor, 400 döndürüyor: beşinci bir seçenek sunmak kullanıcıya
    // tıklandığında hata veren bir düğme vermek olurdu.
    for (const option of jobSortOptions) {
      expect(sortableFields).toContain(option.field.split(",")[0]);
    }
  });

  it("adres çubuğundaki ham girdiyi sunucuya geçirmez", () => {
    expect(backendParams({ sirala: "password,desc" }).get("sort")).toBe("createdAt,desc");
    expect(backendParams({ sirala: "createdAt,desc" }).get("sort")).toBe("createdAt,desc");
  });

  it("tanıdığı Türkçe sıralamayı sunucunun alanına çevirir", () => {
    expect(backendParams({ sirala: "ucret-azalan" }).get("sort")).toBe("salary,desc");
    expect(backendParams({ sirala: "baslangic" }).get("sort")).toBe("startDateTime,asc");
    expect(backendParams({ sirala: "baslik" }).get("sort")).toBe("title,asc");
  });

  it("mobilin sunduğu sıralamaların aynısını sunar", () => {
    /*
     * `koala-mobile` `JobSortOption` beş seçim tanımlıyor ve iki istemci aynı
     * `GET /jobs` ucunu çağırıyor: webde olmayan bir sıralama, aynı aramanın
     * platforma göre başka sıralanması demek. Beklenen liste **elle** yazılı;
     * `jobSortOptions.map(...)` ile üretilseydi iddia kendi ölçtüğü diziden
     * kurulur ve bir seçenek düştüğünde birlikte kayardı.
     */
    expect(jobSortOptions.map((option) => option.field)).toEqual([
      "createdAt,desc",
      "startDateTime,asc",
      "salary,desc",
      "salary,asc",
      "title,asc",
    ]);
  });
});

describe("sayfalama", () => {
  it("1 tabanlı sayfa numarasını 0 tabanlı `page` değerine çevirir", () => {
    expect(backendParams({ sayfa: "1" }).get("page")).toBe("0");
    expect(backendParams({ sayfa: "3" }).get("page")).toBe("2");
  });

  it("sayfa boyutunu sabitler ve URL'den değiştirilemez", () => {
    // Beklenti **elle** yazılı, sabitten okunmuyor: `String(jobPageSize)`
    // yazılsaydı iddia kendi ölçtüğü değerden kurulurdu ve sabit 55 olduğunda
    // da yeşil kalırdı — yani başlığının ilk yarısını ("sabitler") hiç
    // ölçmezdi. Yirmi sunucunun `@PageableDefault` değeri; değişirse bu satır
    // da bilerek değişmeli.
    expect(backendParams({ sayfa: "2", size: "100" }).get("size")).toBe("20");
  });

  it("geçersiz sayfa numaralarında ilk sayfaya düşer", () => {
    for (const sayfa of ["0", "-1", "abc", "", "1.5", "٣"]) {
      expect(parseJobSearchParams({ sayfa }).page, sayfa).toBe(1);
    }
  });

  it("çok büyük sayfa numarasını güvenli bir tavanda kırpar", () => {
    // Kırpılan sayfa boş bir sonuç veriyor — bu bir hata değil, `PageDto`
    // 200 ile boş `content` döndürüyor.
    expect(parseJobSearchParams({ sayfa: "999999" }).page).toBe(100_000);
    expect(parseJobSearchParams({ sayfa: "9".repeat(30) }).page).toBe(100_000);
    expect(Number.isSafeInteger(Number(backendParams({ sayfa: "9".repeat(30) }).get("page")))).toBe(
      true,
    );
  });
});

describe("ilçe seçimi", () => {
  it("il seçilmeden gelen ilçeyi düşürür", () => {
    expect(parseJobSearchParams({ ilce: districtId }).districtId).toBeNull();
  });

  it("il değiştiğinde formun taşıdığı ilçe seçimi düşer", () => {
    // JavaScript'siz form, il değişse bile ekrandaki eski ilçeyi gönderiyor;
    // gizli alan listenin hangi ile ait olduğunu söylüyor.
    const query = parseJobSearchParams({
      il: otherCityId,
      ilce: districtId,
      [districtCityParamName]: cityId,
    });

    expect(query.cityId).toBe(otherCityId);
    expect(query.districtId).toBeNull();
  });

  it("il değişmediyse ilçe seçimi korunur", () => {
    const query = parseJobSearchParams({
      il: cityId,
      ilce: districtId,
      [districtCityParamName]: cityId,
    });

    expect(query.districtId).toBe(districtId);
  });

  it("elle yazılmış geçerli bir il/ilçe çifti korunur", () => {
    expect(parseJobSearchParams({ il: cityId, ilce: districtId }).districtId).toBe(districtId);
  });
});

describe("adres çubuğuna geri yazma", () => {
  const base: JobSearchQuery = {
    page: 1,
    text: null,
    categoryId: null,
    cityId: null,
    districtId: null,
    type: null,
    salaryType: null,
    employerType: null,
    minSalary: null,
    maxSalary: null,
    insuranceRequired: null,
    experienceRequired: null,
    sort: "en-yeni",
  };

  it("varsayılan sayfa ve sıralamayı URL'ye yazmaz", () => {
    expect(jobSearchParams(base).size).toBe(0);
  });

  it("seçimi Türkçe parametrelerle yazar ve tekrar okuyabilir", () => {
    const query: JobSearchQuery = {
      ...base,
      page: 3,
      text: "garson",
      cityId,
      districtId,
      type: "RECURRING",
      sort: "ucret-artan",
    };
    const written = Object.fromEntries(jobSearchParams(query));

    expect(written).toEqual({
      ara: "garson",
      il: cityId,
      ilce: districtId,
      tur: "RECURRING",
      sirala: "ucret-artan",
      sayfa: "3",
    });
    expect(parseJobSearchParams(written)).toEqual(query);
  });

  it("süzgeci sayfa ve sıralamadan ayırır", () => {
    // İndeksleme kararı buna bakıyor: sayfa ve sıralama aynı kümenin farklı
    // dilimleri, süzgeç ise başka bir küme.
    expect(hasJobFilters({ ...base, page: 4, sort: "ucret-azalan" })).toBe(false);
    expect(hasJobFilters({ ...base, text: "garson" })).toBe(true);
    expect(hasJobFilters({ ...base, cityId })).toBe(true);
  });

  it("altı yeni süzgecin her biri tek başına sayfayı indekslenemez yapar", () => {
    /*
     * Altısı da `JobDao.searchIds` içinde ayrı bir `where` koşulu, yani sonuç
     * **kümesini** değiştiriyorlar — sıralamanın tersi. `hasJobFilters` biri
     * için `false` dönseydi o URL `noindex` almaz ve süzülmüş bir sayfa
     * süzgeçsiz listenin canonical'ıyla indekslenirdi.
     */
    const single: readonly Partial<JobSearchQuery>[] = [
      { salaryType: "HOURLY" },
      { employerType: "COMPANY" },
      { minSalary: "500" },
      { maxSalary: "500" },
      { insuranceRequired: true },
      { experienceRequired: false },
    ];

    for (const patch of single) {
      expect(hasJobFilters({ ...base, ...patch }), JSON.stringify(patch)).toBe(true);
    }
  });
});

describe("tam süzgeç seti", () => {
  it("altı yeni süzgeci sunucunun alan adlarına çevirir", () => {
    const params = backendParams({
      "ucret-tipi": "HOURLY",
      isveren: "COMPANY",
      "min-ucret": "500",
      "max-ucret": "1500.50",
      sigorta: "evet",
      deneyim: "hayir",
    });

    expect(params.get("salaryType")).toBe("HOURLY");
    expect(params.get("employerType")).toBe("COMPANY");
    expect(params.get("minSalary")).toBe("500");
    expect(params.get("maxSalary")).toBe("1500.50");
    // `JobSearchCriteriaDto` alanı `Boolean`; Spring `true`/`false` bekliyor,
    // adres çubuğundaki `evet`/`hayir` sunucuya hiç çıkmıyor.
    expect(params.get("insuranceRequired")).toBe("true");
    expect(params.get("experienceRequired")).toBe("false");
  });

  it("seçilmemiş süzgeci istekte hiç göstermez", () => {
    const params = backendParams({});

    expect([...params.keys()].toSorted()).toEqual(["page", "size", "sort"]);
  });

  it("enum'da olmayan ücret ve işveren tipini düşürür", () => {
    // `SalaryType` yalnız HOURLY/DAILY, `JobEmployerType` yalnız
    // COMPANY/INDIVIDUAL. `UNKNOWN` bir yanıtın okunamamış olması, sunucuda
    // karşılığı olan bir sabit değil: Spring bind aşamasında 400 üretirdi.
    for (const raw of ["UNKNOWN", "WEEKLY", "hourly", "", "COMPANY,INDIVIDUAL"]) {
      expect(backendParams({ "ucret-tipi": raw }).has("salaryType"), raw).toBe(false);
      expect(backendParams({ isveren: raw }).has("employerType"), raw).toBe(false);
    }
  });

  it("evet/hayir dışındaki üç durumlu değeri düşürür", () => {
    for (const raw of ["true", "1", "EVET", "belki", "", "constructor", "toString"]) {
      expect(backendParams({ sigorta: raw }).has("insuranceRequired"), raw).toBe(false);
      expect(backendParams({ deneyim: raw }).has("experienceRequired"), raw).toBe(false);
    }
  });

  it("üç durumu birbirine katlamaz", () => {
    // `false` "sigortasız ilanları göster" demek, "süzme" demek değil:
    // `JobDao.searchIds` `null` gördüğünde koşulu hiç uygulamıyor.
    expect(parseJobSearchParams({ sigorta: "hayir" }).insuranceRequired).toBe(false);
    expect(parseJobSearchParams({ sigorta: "evet" }).insuranceRequired).toBe(true);
    expect(parseJobSearchParams({}).insuranceRequired).toBeNull();
    expect(backendParams({ sigorta: "hayir" }).get("insuranceRequired")).toBe("false");
  });

  it("ondalık olmayan ücret sınırını sunucuya taşımaz", () => {
    // Alan sunucuda `BigDecimal`; bozuk bir değer bind aşamasında 400 üretir
    // ve herkese açık sayfa ziyaretçinin düzeltemeyeceği bir hataya düşerdi.
    for (const raw of ["abc", "1e5", "1,50", "0x10", "", " ", "٣", "Infinity", "500.123"]) {
      expect(backendParams({ "min-ucret": raw }).has("minSalary"), raw).toBe(false);
    }
  });

  it("eksi ücret sınırını bir seçim saymaz", () => {
    // Sunucu kabul eder ve boş sonuç dönerdi, ama "En az -1 ₺" rozeti
    // kullanıcıya yapmadığı bir tercihi geri okurdu.
    expect(backendParams({ "min-ucret": "-1" }).has("minSalary")).toBe(false);
    expect(backendParams({ "max-ucret": "-0.01" }).has("maxSalary")).toBe(false);
  });

  it("ücret sınırını sütunun ölçeğinde kabul eder", () => {
    /*
     * `jobs.salary` sütunu `NUMERIC(19, 2)`: tam kısım en çok on yedi hane,
     * ondalık en çok iki. Sınırlar **elle** yazılı — kalıptan üretilseydi
     * iddia kendi ölçtüğü kalıptan kurulur ve kalıp gevşediğinde birlikte
     * kayardı.
     */
    expect(backendParams({ "min-ucret": "0" }).get("minSalary")).toBe("0");
    expect(backendParams({ "min-ucret": "0.05" }).get("minSalary")).toBe("0.05");
    expect(backendParams({ "min-ucret": "99999999999999999" }).get("minSalary")).toBe(
      "99999999999999999",
    );
    expect(backendParams({ "min-ucret": "999999999999999999" }).has("minSalary")).toBe(false);
  });

  it("ücret sınırını sayıya çevirmeden taşır", () => {
    // `money.ts` bütün modülde `Number`'dan kaçınıyor; `Number("1500.50")`
    // üstünden geçen bir sınır sunucuya kayan noktayla yeniden üretilmiş
    // olarak giderdi.
    expect(backendParams({ "min-ucret": "1500.50" }).get("minSalary")).toBe("1500.50");
    expect(backendParams({ "min-ucret": "007" }).get("minSalary")).toBe("007");
  });

  it("ters aralığı sessizce düzeltmez", () => {
    // Sunucu boş sonuç döndürüyor ve boş sonuç ekranı süzgeci gevşetmeyi
    // söylüyor; sınırları yer değiştirmek kullanıcının sormadığı bir soruyu
    // cevaplayıp sonucu onun aralığıymış gibi göstermek olurdu.
    const params = backendParams({ "min-ucret": "1500", "max-ucret": "500" });

    expect(params.get("minSalary")).toBe("1500");
    expect(params.get("maxSalary")).toBe("500");
  });

  it("tekrarlanan yeni süzgeç parametresini tek bir seçim saymaz", () => {
    const params = backendParams({
      "ucret-tipi": ["HOURLY", "DAILY"],
      sigorta: ["evet", "hayir"],
      "min-ucret": ["500", "600"],
    });

    expect(params.has("salaryType")).toBe(false);
    expect(params.has("insuranceRequired")).toBe(false);
    expect(params.has("minSalary")).toBe(false);
  });

  it("tam seti yazıp geri okuyabilir", () => {
    const query: JobSearchQuery = {
      page: 2,
      text: "garson",
      categoryId,
      cityId,
      districtId,
      type: "ONE_TIME",
      salaryType: "DAILY",
      employerType: "INDIVIDUAL",
      minSalary: "500",
      maxSalary: "1500.50",
      insuranceRequired: true,
      experienceRequired: false,
      sort: "baslik",
    };
    const written = Object.fromEntries(jobSearchParams(query));

    expect(written).toEqual({
      ara: "garson",
      kategori: categoryId,
      il: cityId,
      ilce: districtId,
      tur: "ONE_TIME",
      "ucret-tipi": "DAILY",
      isveren: "INDIVIDUAL",
      "min-ucret": "500",
      "max-ucret": "1500.50",
      sigorta: "evet",
      deneyim: "hayir",
      sirala: "baslik",
      sayfa: "2",
    });
    expect(parseJobSearchParams(written)).toEqual(query);
  });
});

describe("silinebilir süzgeç rozetleri", () => {
  const options: JobFilterOptions = {
    categories: [{ id: categoryId, name: "Garsonluk" }],
    cities: [{ id: cityId, name: "İstanbul" }],
    districts: [{ id: districtId, name: "Kadıköy" }],
  };

  function labels(raw: Record<string, string | string[] | undefined>): string[] {
    return activeJobFilters(parseJobSearchParams(raw), options).map((filter) => filter.label);
  }

  it("seçili süzgeçleri okunur metinlerle listeler", () => {
    expect(
      labels({
        ara: "garson",
        kategori: categoryId,
        il: cityId,
        ilce: districtId,
        tur: "ONE_TIME",
        "ucret-tipi": "DAILY",
        isveren: "INDIVIDUAL",
        "min-ucret": "500",
        "max-ucret": "1500.5",
        sigorta: "hayir",
        deneyim: "evet",
      }),
    ).toEqual([
      "“garson” araması",
      "Garsonluk",
      "İstanbul",
      "Kadıköy",
      "Tek seferlik",
      "Günlük ücret",
      "Bireysel ilan",
      "En az 500,00 ₺",
      "En çok 1.500,50 ₺",
      "Sigortasız ilanlar",
      "Deneyim isteniyor",
    ]);
  });

  it("sıralama ve sayfa rozet çizmez", () => {
    // İkisi de aynı kümenin dilimi; "kaldır" düğmesi aslında "varsayılana dön"
    // demek olurdu ve bir sıralama her zaman seçili.
    expect(labels({ sirala: "ucret-artan", sayfa: "3" })).toEqual([]);
  });

  it("bir rozeti kaldırmak yalnız o süzgeci düşürür ve ilk sayfaya döner", () => {
    const query = parseJobSearchParams({ sayfa: "4", il: cityId, "ucret-tipi": "HOURLY" });
    const salaryType = activeJobFilters(query, options).find(
      (filter) => filter.id === "ucret-tipi",
    );

    expect(salaryType?.without).toEqual({ ...query, salaryType: null, page: 1 });
  });

  it("il rozetini kaldırmak ilçeyi de düşürür", () => {
    // İlçeler ilin kimliğiyle çekiliyor; il kalkınca ilçe seçimi sahipsiz
    // kalır ve adres çubuğunda ölü bir parametre olarak dururdu.
    const query = parseJobSearchParams({ il: cityId, ilce: districtId });
    const city = activeJobFilters(query, options).find((filter) => filter.id === "il");

    expect(city?.without.cityId).toBeNull();
    expect(city?.without.districtId).toBeNull();
  });

  it("sözlük okunamadığında rozet kaybolmaz", () => {
    // Sözlük çağrısı başarısız olduğunda sayfa kutuları boş bırakıp listeyi
    // çizmeye devam ediyor; rozet o durumda da kaldırılabilmeli, ama ekrana
    // ham kimliği basmamalı.
    const empty: JobFilterOptions = { categories: [], cities: [], districts: [] };
    const filters = activeJobFilters(parseJobSearchParams({ il: cityId }), empty);

    expect(filters.map((filter) => filter.label)).toEqual(["Seçili il"]);
    expect(filters[0].without.cityId).toBeNull();
  });
});
