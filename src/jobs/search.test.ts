import { describe, expect, it } from "vitest";

import {
  activeJobFilters,
  backendJobSearchParams,
  districtCityParamName,
  hasJobFilters,
  jobDistanceKm,
  jobSearchParamNames,
  jobSearchParams,
  jobSortOptions,
  orderPageByDistance,
  parseJobSearchParams,
  type JobFilterOptions,
  type JobSearchQuery,
  type JobSummary,
  type RawSearchParams,
} from "./search";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherCityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const districtId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** Yakınlık testlerinin ortak ilanı; yalnız koordinatları değişiyor. */
const job: JobSummary = {
  id: "job",
  title: "Garson",
  position: null,
  sector: null,
  categoryId: null,
  categoryName: null,
  categoryCode: null,
  employerType: "INDIVIDUAL",
  type: "ONE_TIME",
  salaryType: "DAILY",
  salary: null,
  workerPayout: null,
  currency: null,
  insuranceRequired: false,
  experienceRequired: false,
  startsAt: "2026-09-20T09:00:00",
  endsAt: "2026-09-20T18:00:00",
  status: "OPEN",
  cityName: null,
  districtName: null,
  companyName: null,
  coverImageUrl: null,
  applicationCount: 0,
  headcount: null,
  hiredCount: 0,
  latitude: null,
  longitude: null,
  addressPrecision: "APPROXIMATE",
};

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
    location: null,
    distanceKm: null,
    view: "liste",
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
    expect(backendParams({ "min-ucret": "0.05" }).get("minSalary")).toBe("0.05");
  });

  it("baştaki sıfırları kırpar, sınırı düşürmez", () => {
    /*
     * `007` eksi bir değerin aksine gerçek bir sınır taşıyor: düşürmek
     * kullanıcının koyduğu süzgeci sessizce kaldırmak olurdu. Ama olduğu gibi
     * taşımak da rozete "En az 007,00 ₺" yazdırıyordu — on yedi haneye kadar
     * "En çok 00.000.000.000.000.005,00 ₺" — yani kullanıcıya yapmadığı bir
     * tercihi geri okuyordu. Eksi değerin gerekçesinin aynısı, kararı ayrı:
     * orada geri okunacak bir seçim yok, burada var.
     */
    expect(backendParams({ "min-ucret": "007" }).get("minSalary")).toBe("7");
    expect(backendParams({ "max-ucret": "00000000000000005" }).get("maxSalary")).toBe("5");
    // Tam kısmın tek sıfırı duruyor: `.05` sunucuda `BigDecimal`'e bind edilmez.
    expect(backendParams({ "min-ucret": "00.05" }).get("minSalary")).toBe("0.05");
    expect(backendParams({ "min-ucret": "000" }).get("minSalary")).toBe("0");
    // Kırpma kalıptan önce: kalıp sütunun taşıyabileceği **büyüklüğü** ölçüyor
    // ve baştaki sıfır o büyüklüğü değiştirmiyor.
    expect(backendParams({ "min-ucret": `${"0".repeat(8)}99999999999999999` }).get("minSalary")).toBe(
      "99999999999999999",
    );
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
      location: { latitude: 41.008238, longitude: 28.978359 },
      distanceKm: 10,
      view: "harita",
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
      "max-ucret": "1500.5",
      sigorta: "evet",
      deneyim: "hayir",
      konum: "41.008238,28.978359",
      mesafe: "10",
      sirala: "baslik",
      gorunum: "harita",
      sayfa: "2",
    });
    expect(parseJobSearchParams(written)).toEqual({ ...query, maxSalary: "1500.5" });
  });
});

describe("konum süzgeci ve yakınlık sıralaması", () => {
  const konum = "41.008238,28.978359";

  it("konumsuz yarıçapı ve konumsuz yakınlık sıralamasını düşürür", () => {
    const query = parseJobSearchParams({ mesafe: "10", sirala: "en-yakin" });
    expect(query.location).toBeNull();
    expect(query.distanceKm).toBeNull();
    expect(query.sort).toBe("en-yeni");
    expect(jobSearchParams(query).size).toBe(0);
  });

  it("konum varken varsayılan yarıçapı alır ve yakınlık sıralamasını korur", () => {
    const query = parseJobSearchParams({ konum, sirala: "en-yakin" });
    expect(query.location).toEqual({ latitude: 41.008238, longitude: 28.978359 });
    expect(query.distanceKm).toBe(5);
    expect(query.sort).toBe("en-yakin");
    // Varsayılan yarıçap adres çubuğuna yazılmaz; yakınlık yazılır.
    expect(Object.fromEntries(jobSearchParams(query))).toEqual({ konum, sirala: "en-yakin" });
  });

  it("yarıçapı backend'in sınırlayıcı kutusuna çevirir; yakınlık sunucuya varsayılan sırayla gider", () => {
    const params = backendJobSearchParams(parseJobSearchParams({ konum, mesafe: "3", sirala: "en-yakin" }));
    expect(Number(params.get("minLatitude"))).toBeLessThan(41.008238);
    expect(Number(params.get("maxLatitude"))).toBeGreaterThan(41.008238);
    expect(Number(params.get("minLongitude"))).toBeLessThan(28.978359);
    expect(Number(params.get("maxLongitude"))).toBeGreaterThan(28.978359);
    // `SORTABLE_FIELDS` mesafeyi tanımıyor; bilinmeyen alan 400 üretirdi.
    expect(params.get("sort")).toBe("createdAt,desc");
  });

  it("gelen sayfayı yalnız yakınlık seçiliyken diziyor; koordinatsız ilan sona düşer", () => {
    const near = { ...job, id: "near", latitude: 41.01, longitude: 28.98 };
    const far = { ...job, id: "far", latitude: 41.1, longitude: 29.1 };
    const unknown = { ...job, id: "unknown", latitude: null, longitude: null };

    const nearest = parseJobSearchParams({ konum, sirala: "en-yakin" });
    expect(orderPageByDistance([far, unknown, near], nearest).map(({ id }) => id)).toEqual([
      "near",
      "far",
      "unknown",
    ]);

    const newest = parseJobSearchParams({ konum });
    expect(orderPageByDistance([far, unknown, near], newest).map(({ id }) => id)).toEqual([
      "far",
      "unknown",
      "near",
    ]);
    expect(jobDistanceKm(unknown, nearest.location!)).toBeNull();
  });

  it("konum rozeti kaldırılınca yarıçap ve yakınlık sıralaması da düşer", () => {
    const query = parseJobSearchParams({ konum, mesafe: "10", sirala: "en-yakin" });
    const filters = activeJobFilters(query, { categories: [], cities: [], districts: [] });
    expect(filters.map(({ id, label }) => [id, label])).toEqual([
      ["konum", "Konumuma yakın"],
      ["mesafe", "10 km çevre"],
    ]);
    expect(filters[0].without).toMatchObject({ location: null, distanceKm: null, sort: "en-yeni" });
    expect(filters[1].without).toMatchObject({ distanceKm: 5, sort: "en-yakin" });
  });

  it("görünüm süzgeç değil: indekslemeyi değiştirmez, adres çubuğunda kalır", () => {
    const query = parseJobSearchParams({ gorunum: "harita" });
    expect(query.view).toBe("harita");
    expect(hasJobFilters(query)).toBe(false);
    expect(Object.fromEntries(jobSearchParams(query))).toEqual({ gorunum: "harita" });
    expect(parseJobSearchParams({ gorunum: "uydu" }).view).toBe("liste");
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

/**
 * Bir süzgeç dokuz yerde biliniyor ve dokuzunun tutarlılığını bugün yalnız
 * yazarın dikkati koruyor.
 *
 * Ölçüldü: yedinci bir süzgeç (`acil`) eklenip dokuzun yalnız üçüne
 * yazıldığında `tsc` sadece iki test literalinde patlıyordu; oralara
 * `urgent: null` yazınca her şey yeşile dönüyordu. Yani adres çubuğundan
 * okunan ama sunucuya hiç gitmeyen, rozet çizmeyen ve `noindex` tetiklemeyen
 * **ölü** bir süzgeç kapıdan geçebiliyordu — ekranda da hata gibi görünmezdi,
 * çünkü eksik olan şey bir davranış değil bir bağlantı.
 *
 * Bu blok o bağlantıyı zorluyor. Örnek tablosunun anahtarları
 * `jobSearchParamNames`'ten türüyor, yani yeni bir süzgeç önce `tsc`'yi
 * (`JobFilterParam` bir birlik) sonra aşağıdaki iddiaları kırıyor.
 *
 * **Göremedikleri**, bilerek yazılı:
 *
 * - `jobSearchParamNames`'e uğramadan, `raw["acil"]` diye doğrudan okunan bir
 *   parametre. Tablo o adı hiç görmez; tek koruma parametre adlarının o tek
 *   kayıtta durması.
 * - Metnin **doğruluğu**. Rozetin bir etiketi olduğunu ölçüyor, etiketin doğru
 *   sözcük olduğunu değil.
 * - Backend **alan adının** `JobSearchCriteriaDto` ile eşleştiği. Yalnız
 *   isteğin değiştiğini görüyor; adın doğruluğunu "altı yeni süzgeci sunucunun
 *   alan adlarına çevirir" ölçüyor.
 * - Formdaki **alanın kendisi**. Kutuların varlığı bu dosyadan görünmüyor;
 *   onu `is-ilanlari/page.test.tsx` içindeki "adres çubuğundaki her süzgeç
 *   formda bir alan olarak duruyor" ölçüyor.
 * - Süzgecin `sirala` ve `sayfa` gibi bir **dilim** değil gerçekten bir küme
 *   daraltması olduğu. Bu ikisi ada göre dışarıda bırakılıyor ve kararı
 *   `hasJobFilters`'ın kendi yorumu taşıyor.
 */
describe("süzgeç listelerinin ayrışmaması", () => {
  /**
   * `sayfa`, `sirala` ve `gorunum` bir süzgeç değil: üçü de aynı kümenin
   * dilimi ya da görünümü; harita aynı ilanları başka bir yüzeyde çiziyor.
   */
  type JobFilterParam = Exclude<
    (typeof jobSearchParamNames)[keyof typeof jobSearchParamNames],
    "sayfa" | "sirala" | "gorunum"
  >;

  /**
   * Her süzgecin adres çubuğundaki örneği.
   *
   * Anahtar tipi bir birlik: `jobSearchParamNames`'e yeni bir süzgeç
   * eklendiğinde bu tablo eksik kalır ve `tsc` onu ilk kapıda söyler.
   * `context`, süzgecin okunabilmesi için gereken diğer parametreler.
   */
  const filterSamples: Readonly<
    Record<JobFilterParam, { readonly value: string; readonly context?: RawSearchParams }>
  > = {
    ara: { value: "garson" },
    kategori: { value: categoryId },
    il: { value: cityId },
    // Tek başına okunmuyor: `districtParam` ilsiz bir ilçeyi düşürüyor.
    ilce: { value: districtId, context: { il: cityId } },
    tur: { value: "ONE_TIME" },
    "ucret-tipi": { value: "HOURLY" },
    isveren: { value: "COMPANY" },
    "min-ucret": { value: "500" },
    "max-ucret": { value: "1500" },
    sigorta: { value: "evet" },
    deneyim: { value: "hayir" },
    konum: { value: "41.008238,28.978359" },
    // Yarıçap konumsuz okunmuyor; varsayılan 5 km olduğu için örnek 10.
    mesafe: { value: "10", context: { konum: "41.008238,28.978359" } },
  };

  const options: JobFilterOptions = { categories: [], cities: [], districts: [] };

  it("adres çubuğundaki her parametrenin bir örneği var", () => {
    // `tsc` kapısının çalışma zamanındaki ikizi: `sayfa`/`sirala` dışlaması
    // burada **alan** adına bakıyor, birlikteki dize adına değil. Yeni bir
    // süzgeç birliğin dışlama listesine yazılarak `tsc`'den kaçırılsaydı bu
    // iddia onu yine görürdü.
    const filterParams = Object.entries(jobSearchParamNames)
      .filter(([field]) => field !== "page" && field !== "sort" && field !== "view")
      .map(([, param]) => param);

    expect(Object.keys(filterSamples).toSorted()).toEqual(filterParams.toSorted());
  });

  it("her süzgeç beş listenin hepsinde birden duruyor", () => {
    for (const [param, sample] of Object.entries(filterSamples)) {
      const context = sample.context ?? {};
      const withFilter = parseJobSearchParams({ ...context, [param]: sample.value });
      const without = parseJobSearchParams(context);

      // 1. Ayrıştırıcı: parametre kanonik modelde bir alana düşüyor.
      expect(withFilter, param).not.toEqual(without);

      // 2. Sunucu: istek gövdesi değişiyor, yani süzgeç gerçekten gidiyor.
      expect(backendJobSearchParams(withFilter).toString(), param).not.toBe(
        backendJobSearchParams(without).toString(),
      );

      // 3. Adres çubuğuna geri yazma: rozet ve sayfalama bağlantıları bunu
      // okuyor; eksik bir satır süzgeci ikinci sayfada düşürürdü.
      expect([...jobSearchParams(withFilter).keys()], param).toContain(param);

      // 4. Rozet: seçim ekranda tek tek kaldırılabilir olarak görünüyor.
      expect(activeJobFilters(withFilter, options).length, param).toBe(
        activeJobFilters(without, options).length + 1,
      );

      // 5. İndeksleme. `ilce` için bu satır bağlamındaki `il` yüzünden zaten
      // doğru; onun asıl ölçüsü yukarıdaki dört fark iddiası.
      expect(hasJobFilters(withFilter), param).toBe(true);
    }
  });
});
