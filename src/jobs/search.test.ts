import { describe, expect, it } from "vitest";

import {
  backendJobSearchParams,
  districtCityParamName,
  hasJobFilters,
  jobSearchPageSize,
  jobSearchParams,
  jobSortOptions,
  parseJobSearchParams,
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
  });
});

describe("sayfalama", () => {
  it("1 tabanlı sayfa numarasını 0 tabanlı `page` değerine çevirir", () => {
    expect(backendParams({ sayfa: "1" }).get("page")).toBe("0");
    expect(backendParams({ sayfa: "3" }).get("page")).toBe("2");
  });

  it("sayfa boyutunu sabitler ve URL'den değiştirilemez", () => {
    expect(backendParams({ sayfa: "2", size: "100" }).get("size")).toBe(String(jobSearchPageSize));
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
});
