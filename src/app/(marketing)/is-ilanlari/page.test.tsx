import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jobSearchParamNames, type JobSearchPage, type JobSummary } from "@/jobs/search";
import { ApiError } from "@/server/api/errors";

import { generateMetadata, JobsPage } from "./page";

const searchJobs = vi.hoisted(() => vi.fn());
const readJobFilterOptions = vi.hoisted(() => vi.fn());

vi.mock("@/server/jobs/search", () => ({ searchJobs, readJobFilterOptions }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const districtId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function job(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: jobId,
    title: "Etkinlik görevlisi",
    position: "Karşılama",
    sector: "Etkinlik",
    categoryId,
    categoryName: "Garsonluk",
    categoryCode: "WAITER",
    employerType: "COMPANY",
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: "1250",
    workerPayout: "1250.00",
    currency: "TRY",
    insuranceRequired: true,
    experienceRequired: false,
    startsAt: "2026-09-12T09:00:00",
    endsAt: "2026-09-12T18:00:00",
    status: "OPEN",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    companyName: "Koala Etkinlik",
    coverImageUrl: null,
    applicationCount: 4,
    headcount: 3,
    hiredCount: 1,
    latitude: 40.99,
    longitude: 29.03,
    addressPrecision: "APPROXIMATE",
    ...overrides,
  };
}

function page(overrides: Partial<JobSearchPage> = {}): JobSearchPage {
  return {
    content: [job()],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  return JobsPage({ searchParams: Promise.resolve(searchParams) });
}

describe("herkese açık ilan listesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchJobs.mockResolvedValue(page());
    readJobFilterOptions.mockResolvedValue({
      categories: [{ id: categoryId, name: "Garsonluk" }],
      cities: [{ id: cityId, name: "İstanbul" }],
      districts: [],
    });
  });

  it("ilanları sunucuda çizer; başlık ve ayrıntı bağlantısı HTML'de durur", async () => {
    // Sayfanın var oluş sebebi: JavaScript kapalıyken de, arama motoru için de
    // ilan başlıkları kaynakta okunabilmeli.
    render(await renderPage());

    expect(screen.getByRole("heading", { level: 1, name: "İş İlanları" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Etkinlik görevlisi" })).toHaveAttribute(
      "href",
      `/is-ilanlari/${jobId}`,
    );

    // Kartın içine daraltılmış: süzgeç kutusundaki "Sigortalı çalışma"
    // seçeneği kartın rozetiyle **bilerek** aynı sözcükleri kullanıyor
    // (kullanıcı süzdüğü şeyi kartta aynı adla görmeli), o yüzden sayfa
    // genelinde arayan bir sorgu iki düğüm bulur.
    const card = screen.getByRole("article", { name: "Etkinlik görevlisi" });
    expect(within(card).getByText("1.250,00 ₺ / günlük")).toBeVisible();
    expect(within(card).getByText("12 Eylül 2026")).toBeVisible();
    expect(within(card).getByText("Sigortalı çalışma")).toBeVisible();
  });

  it("yaklaşık konumu kesinmiş gibi göstermez ve koordinatı hiç yazmaz", async () => {
    // ADR-0003: anonim ziyaretçiye giden koordinat iki ondalığa yuvarlanmış bir
    // bölge. Kartta ne enlem ne boylam görünmeli, ve "Kadıköy, İstanbul" tam
    // adres sanılmasın diye yaklaşıklık yazıyla söylenmeli.
    const { container } = render(await renderPage());

    expect(screen.getByText("Kadıköy, İstanbul (yaklaşık)")).toBeVisible();
    expect(container.textContent).not.toContain("40.99");
    expect(container.textContent).not.toContain("29.03");
  });

  it("adresi herkese açık ilanda yaklaşıklık notu düşer ama koordinat yine yazılmaz", async () => {
    // Koordinat yasağının asıl ölçüldüğü yer burası. `JobMapper:33-34` lat/lng'yi
    // **her zaman** `approximateCoordinate` ile yazıyor; `JobAddressVisibility.protect`
    // yalnız `EXACT` dalında kesin değeri üzerine koyuyor. Yani tam hassasiyetli
    // koordinat yalnız bu dalda var ve yasak yalnız burada bir şey ifade ediyor —
    // yaklaşık fikstürde aynı iddia, değer zaten yuvarlanmışken ölçülmüş olurdu.
    searchJobs.mockResolvedValue(
      page({
        content: [
          job({ addressPrecision: "EXACT", latitude: 40.9876543, longitude: 29.0312345 }),
        ],
      }),
    );

    const { container } = render(await renderPage());

    expect(screen.getByText("Kadıköy, İstanbul")).toBeVisible();
    // `innerHTML`, `textContent` değil: koordinat bir metin düğümüne değil bir
    // `data-` özniteliğine de yazılabilir ve harita issue'su geldiğinde ilk
    // deneyeceği yer orası.
    expect(container.innerHTML).not.toContain("40.98");
    expect(container.innerHTML).not.toContain("29.03");
    expect(container.innerHTML).not.toContain("latitude");
    expect(container.innerHTML).not.toContain("longitude");
    expect(container.innerHTML).not.toContain("addressPrecision");
    expect(container.innerHTML).not.toContain("EXACT");
  });

  it("süzgeci sunucuya kanonik alanlarıyla götürür", async () => {
    await renderPage({ ara: "garson", kategori: categoryId, il: cityId, tur: "ONE_TIME" });

    expect(searchJobs).toHaveBeenCalledWith({
      page: 1,
      text: "garson",
      categoryId,
      cityId,
      districtId: null,
      type: "ONE_TIME",
      salaryType: null,
      employerType: null,
      minSalary: null,
      maxSalary: null,
      insuranceRequired: null,
      experienceRequired: null,
      sort: "en-yeni",
    });
  });

  it("tam süzgeç setini sunucuya götürür", async () => {
    await renderPage({
      "ucret-tipi": "HOURLY",
      isveren: "INDIVIDUAL",
      "min-ucret": "250",
      "max-ucret": "900.50",
      sigorta: "evet",
      deneyim: "hayir",
      sirala: "baslik",
    });

    expect(searchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        salaryType: "HOURLY",
        employerType: "INDIVIDUAL",
        minSalary: "250",
        maxSalary: "900.50",
        insuranceRequired: true,
        experienceRequired: false,
        sort: "baslik",
      }),
    );
  });

  it("beyaz liste dışı süzgeç değerini sunucuya hiç taşımaz", async () => {
    // Spring bu alanları enum ve `BigDecimal`'e bind ediyor: bozuk bir değer
    // 400 üretir ve herkese açık sayfa, ziyaretçinin düzeltemeyeceği bir
    // hataya düşerdi.
    await renderPage({
      "ucret-tipi": "WEEKLY",
      isveren: "UNKNOWN",
      "min-ucret": "bedava",
      "max-ucret": "-5",
      sigorta: "true",
      deneyim: "1",
    });

    expect(searchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        salaryType: null,
        employerType: null,
        minSalary: null,
        maxSalary: null,
        insuranceRequired: null,
        experienceRequired: null,
      }),
    );
  });

  it("altı yeni süzgeci klavyeyle kullanılabilir alanlar olarak çizer", async () => {
    render(await renderPage({ "ucret-tipi": "DAILY", "min-ucret": "250", sigorta: "hayir" }));

    expect(screen.getByLabelText("Ücret tipi")).toHaveValue("DAILY");
    expect(screen.getByLabelText("İlanı veren")).toHaveValue("");
    expect(screen.getByLabelText("En az ücret (₺)")).toHaveValue(250);
    expect(screen.getByLabelText("En çok ücret (₺)")).toHaveValue(null);
    // Üç durumlu: "hayır" seçili, "farketmez" değil.
    expect(screen.getByLabelText("Sigorta")).toHaveValue("hayir");
    expect(screen.getByLabelText("Deneyim")).toHaveValue("");
  });

  it("seçili süzgeçleri tek tek kaldırılabilir bağlantılar olarak listeler", async () => {
    render(await renderPage({ il: cityId, "ucret-tipi": "DAILY", sayfa: "3" }));

    const badges = screen.getByRole("list", { name: "Seçili süzgeçler" });
    // Bağlantı, düğme değil: JavaScript kapalıyken de bir süzgeç kaldırılmalı.
    expect(within(badges).getByRole("link", { name: "İstanbul süzgecini kaldır" })).toHaveAttribute(
      "href",
      "/is-ilanlari?ucret-tipi=DAILY",
    );
    // Süzgeç kalkınca sonuç kümesi değişiyor; kullanıcıyı eski kümenin üçüncü
    // sayfasında bırakmak boş bir ekran gösterirdi.
    expect(
      within(badges).getByRole("link", { name: "Günlük ücret süzgecini kaldır" }),
    ).toHaveAttribute("href", `/is-ilanlari?il=${cityId}`);
  });

  it("adres çubuğundaki her süzgeç formda bir alan olarak duruyor", async () => {
    /*
     * Bir süzgeç dokuz yerde biliniyor ve `tsc` bunların ayrışmasını
     * görmüyordu: yedinci bir süzgeç eklenip yalnız üçüne yazıldığında
     * derleyici sessiz kalıyor ve adres çubuğundan okunan ama formda kutusu
     * olmayan bir süzgeç kapıdan geçiyordu. Bu iddia listeyi
     * `jobSearchParamNames`'ten türetiyor, elle yazmıyor — yeni bir süzgeç
     * kutusuz kaldığı anda kırmızıya dönüyor.
     *
     * `sayfa` bilerek dışarıda: yeni bir süzgeç yeni bir sonuç kümesi demek ve
     * kullanıcıyı o kümenin yedinci sayfasında bırakmak boş bir ekran
     * gösterirdi (`JobSearchForm` yorumu).
     */
    readJobFilterOptions.mockResolvedValue({
      categories: [{ id: categoryId, name: "Garsonluk" }],
      cities: [{ id: cityId, name: "İstanbul" }],
      districts: [{ id: districtId, name: "Kadıköy" }],
    });

    const { container } = render(await renderPage({ il: cityId }));
    const form = container.querySelector("form")!;

    for (const [field, param] of Object.entries(jobSearchParamNames)) {
      if (field === "page") continue;
      expect(form.elements.namedItem(param), param).not.toBeNull();
    }
  });

  it("süzgeç seçili değilken rozet şeridi hiç çizilmez", async () => {
    render(await renderPage({ sirala: "ucret-artan", sayfa: "2" }));

    expect(screen.queryByRole("list", { name: "Seçili süzgeçler" })).toBeNull();
  });

  it("uydurma bir sıralamayı sunucuya taşımaz, varsayılana düşer", async () => {
    // `PageableSanitizer.rejectUnknownSort` bilinmeyen alanı 400 ile
    // reddediyor: ham girdiyi taşımak sayfayı çökertirdi.
    await renderPage({ sirala: "password,desc" });

    expect(searchJobs).toHaveBeenCalledWith(expect.objectContaining({ sort: "en-yeni" }));
  });

  it("bozuk sayfa numaraları sayfayı kırmaz", async () => {
    for (const sayfa of ["abc", "-1", "0"]) {
      searchJobs.mockClear();
      render(await renderPage({ sayfa }));
      expect(searchJobs, sayfa).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    }

    searchJobs.mockClear();
    render(await renderPage({ sayfa: "999999" }));
    expect(searchJobs).toHaveBeenCalledWith(expect.objectContaining({ page: 100_000 }));
  });

  it("süzgeç formu GET ile gönderiliyor; seçim adres çubuğuna yazılabilsin", async () => {
    const { container } = render(await renderPage({ ara: "garson" }));
    const form = container.querySelector("form")!;

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/is-ilanlari");
    expect(screen.getByLabelText("Ne arıyorsun?")).toHaveValue("garson");
    expect(screen.getByLabelText("Kategori")).toBeVisible();
    expect(screen.getByLabelText("İl")).toBeVisible();
  });

  it("il seçilmeden ilçe listesi sunmaz", async () => {
    render(await renderPage());

    expect(screen.queryByLabelText("İlçe")).toBeNull();
  });

  it("il seçiliyken ilçe kutusunu ve listenin hangi ile ait olduğunu yazar", async () => {
    readJobFilterOptions.mockResolvedValue({
      categories: [],
      cities: [{ id: cityId, name: "İstanbul" }],
      districts: [{ id: districtId, name: "Kadıköy" }],
    });

    const { container } = render(await renderPage({ il: cityId }));

    expect(screen.getByLabelText("İlçe")).toBeVisible();
    expect(readJobFilterOptions).toHaveBeenCalledWith(cityId);
    // Gizli alan olmadan, il değiştirilip gönderildiğinde eski ilçe seçimi
    // sunucuya taşınır ve liste başka bir ilin ilçesiyle süzülürdü.
    expect(container.querySelector('input[name="ilce-ili"]')).toHaveValue(cityId);
  });

  it("sayfalamayı gerçek bağlantılarla çizer ve süzgeci taşır", async () => {
    searchJobs.mockResolvedValue(page({ page: 1, totalPages: 4, first: false, last: false }));

    render(await renderPage({ sayfa: "2", ara: "garson" }));

    const pagination = screen.getByRole("navigation", { name: "İlan sayfaları" });
    expect(within(pagination).getByText("Sayfa 2 / 4")).toBeVisible();
    expect(within(pagination).getByRole("link", { name: "Önceki sayfa" })).toHaveAttribute(
      "href",
      "/is-ilanlari?ara=garson",
    );
    expect(within(pagination).getByRole("link", { name: "Sonraki sayfa" })).toHaveAttribute(
      "href",
      "/is-ilanlari?ara=garson&sayfa=3",
    );
  });

  it("tek sayfalık sonuçta sayfalama çizmez", async () => {
    render(await renderPage());

    expect(screen.queryByRole("navigation", { name: "İlan sayfaları" })).toBeNull();
  });
});

describe("ilan listesinin ekran durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readJobFilterOptions.mockResolvedValue({ categories: [], cities: [], districts: [] });
  });

  it("hiç ilan yokken boş durumu gösterir, hata değil", async () => {
    // `PageDto.content` boş dizi 200 ile dönüyor; bu bir arıza değil.
    searchJobs.mockResolvedValue(page({ content: [], totalElements: 0, totalPages: 0 }));

    render(await renderPage());

    expect(screen.getByRole("status")).toHaveTextContent("Henüz ilan yok");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("süzgeçli boş sonucu 'hiç ilan yok' ile karıştırmaz", async () => {
    searchJobs.mockResolvedValue(page({ content: [], totalElements: 0, totalPages: 0 }));

    render(await renderPage({ ara: "uzay mühendisi" }));

    expect(screen.getByRole("status")).toHaveTextContent("Bu süzgeçlere uyan ilan yok");
  });

  it("menzil dışı sayfayı 'sitede ilan yok' gibi göstermez", async () => {
    // Altmış ilan varken `?sayfa=999`: sunucu 200 ve boş `content` döndürüyor
    // ama `totalElements` yerinde duruyor. Üçüncü bir hâl — ne site boş ne de
    // süzgeç fazla dar — ve kendi metnini hak ediyor (`AGENTS.md` § "Ekran
    // durumları").
    searchJobs.mockResolvedValue(
      page({ content: [], page: 998, totalElements: 60, totalPages: 3, first: false, last: true }),
    );

    render(await renderPage({ sayfa: "999" }));

    const state = screen.getByRole("status");
    expect(state).toHaveTextContent("Bu numarada bir sayfa yok");
    expect(state).not.toHaveTextContent("Henüz ilan yok");
    expect(state).not.toHaveTextContent("Bu süzgeçlere uyan ilan yok");

    // Dönüş bağlantısı gerçek bir sayfaya gidiyor; 998 de menzil dışıydı.
    expect(screen.getByRole("link", { name: /Son sayfaya dön/ })).toHaveAttribute(
      "href",
      "/is-ilanlari?sayfa=3",
    );

    // "Sayfa 999 / 3" bir konum değil; şerit hiç çizilmiyor.
    expect(screen.queryByRole("navigation", { name: "İlan sayfaları" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Önceki sayfa" })).toBeNull();
  });

  it("menzil dışı sayfadan dönerken süzgeci düşürmez", async () => {
    searchJobs.mockResolvedValue(
      page({ content: [], page: 998, totalElements: 41, totalPages: 3, first: false, last: true }),
    );

    render(await renderPage({ sayfa: "999", ara: "garson" }));

    expect(screen.getByRole("link", { name: /Son sayfaya dön/ })).toHaveAttribute(
      "href",
      "/is-ilanlari?ara=garson&sayfa=3",
    );
  });

  it("liste okunamazsa hatayı `errorCode` ile seçilmiş Türkçe metinle yazar", async () => {
    searchJobs.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: "PAGE_SORT_FIELD_NOT_ALLOWED",
        errorCategory: "VALIDATION",
        message: "Sorting field is not allowed",
      }),
    );

    render(await renderPage());

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bu sıralama desteklenmiyor");
    // Backend'in ham metni ekrana çıkmaz (`AGENTS.md` § "Ekran durumları").
    expect(alert).not.toHaveTextContent("Sorting field is not allowed");
  });

  it("başarısız yükleme ile boş liste aynı görünmez", async () => {
    searchJobs.mockRejectedValue(
      new ApiError({ status: 500, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "" }),
    );

    render(await renderPage());

    // Boş durum `role="status"`, hata `role="alert"`: ekran okuyucu için de
    // gözle bakan için de ayrı iki şey.
    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sözlükler okunamasa bile ilanları çizmeye devam eder", async () => {
    // Kullanıcının asıl geldiği şey ilanlar; süzgeç kutusu boş kalabilir.
    readJobFilterOptions.mockRejectedValue(
      new ApiError({ status: 503, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "" }),
    );
    searchJobs.mockResolvedValue(page());

    render(await renderPage());

    expect(screen.getByRole("link", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sözlük okunamadığında formu göndermek il, ilçe ve kategori seçimini kaybettirmez", async () => {
    /*
     * Rozet şeridi bu üç seçimi "seçili" gösteriyor ama form onları
     * taşımıyordu: sözlük ucu düştüğünde kutuların içi boş kalıyor, tarayıcı
     * eşleşmeyen `defaultValue`'yu ilk seçeneğe (boş dize) düşürüyor ve ilçe
     * kutusu ile onun gizli `ilce-ili` alanı hiç çizilmiyordu. Yani "İlanları
     * süz"e basan kullanıcı — boş sonuç ekranının **tam da yapmasını
     * söylediği** şey — süzgecini sessizce kaybediyordu.
     *
     * Ölçü gönderimin kendisi: `FormData`, ekrandaki kutu değil. Kutunun
     * görünüşü doğru olup gönderim yine boş çıkabilirdi.
     */
    readJobFilterOptions.mockRejectedValue(
      new ApiError({ status: 503, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "" }),
    );
    searchJobs.mockResolvedValue(page());

    const { container } = render(
      await renderPage({ kategori: categoryId, il: cityId, ilce: districtId, sigorta: "evet" }),
    );
    const submitted = Object.fromEntries(new FormData(container.querySelector("form")!));

    expect(submitted).toMatchObject({
      kategori: categoryId,
      il: cityId,
      ilce: districtId,
      "ilce-ili": cityId,
      sigorta: "evet",
    });

    // Kutuda okunan ad rozetteki adla birebir aynı; iki ayrı metin, aynı
    // seçimin ekranın iki yerinde iki ayrı şey olarak görünmesi olurdu.
    expect(screen.getByLabelText("İl")).toHaveValue(cityId);
    expect(screen.getByRole("option", { name: "Seçili il" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Seçili süzgeçler" })).getByRole("link", {
        name: "Seçili il süzgecini kaldır",
      }),
    ).toBeVisible();
  });

  it("boş sonuçta hangi süzgeçlerin daralttığını yazar", async () => {
    /*
     * Ters bir ücret aralığında daraltan şey ne il ne kategori: sabit metin
     * ("başka bir il ya da kategori seçebilirsin") on bir süzgecin ikisini
     * tanıyıp kullanıcıya yanlış yere baktırıyordu. Issue #20 metnin "hangi
     * filtrelerin daralttığını **söylemesini**" istiyor.
     */
    searchJobs.mockResolvedValue(page({ content: [], totalElements: 0, totalPages: 0 }));

    render(await renderPage({ "min-ucret": "1500", "max-ucret": "500" }));

    const state = screen.getByRole("status");
    expect(state).toHaveTextContent("Bu süzgeçlere uyan ilan yok");
    expect(state).toHaveTextContent("En az 1.500,00 ₺");
    expect(state).toHaveTextContent("En çok 500,00 ₺");
    expect(state).not.toHaveTextContent("il ya da kategori");
  });
});

describe("ilan listesinin indekslenmesi", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://iskoala.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "koala");
  });

  it("süzgeçsiz sayfa kendi canonical'ını taşır", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ sayfa: "2" }) });

    expect(metadata.title).toBe("İş İlanları – Sayfa 2");
    expect(metadata.alternates?.canonical).toBe("https://iskoala.com/is-ilanlari?sayfa=2");
    expect(metadata.robots).toBeUndefined();
  });

  it("sıralama çeşidini canonical'a koymaz; beşi tek adreste birleşir", async () => {
    // `hasJobFilters` sıralamayı bilerek süzgeç saymıyor, yani `?sirala=` bir
    // `noindex` almıyor. Canonical de onu taşısaydı aynı ilan kümesi için beş
    // indekslenebilir URL olurdu — yinelenen içerik. Sayfa numarası ise
    // kalıyor: sayfa 2 başka ilanlar taşıyor.
    const sorted = await generateMetadata({
      searchParams: Promise.resolve({ sirala: "ucret-artan" }),
    });
    expect(sorted.alternates?.canonical).toBe("https://iskoala.com/is-ilanlari");

    const sortedPageTwo = await generateMetadata({
      searchParams: Promise.resolve({ sirala: "ucret-artan", sayfa: "2" }),
    });
    expect(sortedPageTwo.alternates?.canonical).toBe("https://iskoala.com/is-ilanlari?sayfa=2");
    expect(sortedPageTwo.robots).toBeUndefined();
  });

  it("süzgeçli URL noindex ve normalize edilmiş kendi canonical'ını taşır", async () => {
    // Süzgeç kombinasyonları sonsuz sayıda URL demek; hepsi indekslenirse
    // Google yinelenen içerik görür. Canonical ham sorgu sırasını ve geçersiz
    // değerleri değil, parse edilmiş süzgeç kümesini tek sırada yazar.
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ il: cityId, ara: "garson" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      `https://iskoala.com/is-ilanlari?ara=garson&il=${cityId}`,
    );
  });

  it("canonical UUID harflerini ve eşdeğer BigDecimal ölçeklerini tek biçime indirir", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        kategori: categoryId.toUpperCase(),
        il: cityId.toUpperCase(),
        ilce: districtId.toUpperCase(),
        "min-ucret": "005.00",
        "max-ucret": "1500.50",
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      `https://iskoala.com/is-ilanlari?kategori=${categoryId}&il=${cityId}&ilce=${districtId}&min-ucret=5&max-ucret=1500.5`,
    );
  });

  it("altı yeni süzgecin her biri tek başına noindex getirir", async () => {
    /*
     * Sıralamanın tersi: altısı da `JobDao.searchIds` içinde ayrı bir `where`
     * koşulu ve sunucudan **başka** ilanlar döndürüyorlar. `sirala` gibi
     * canonical'dan silinselerdi, süzülmüş bir sayfa "asıl adresim süzgeçsiz
     * liste" derdi ve Google'ın gördüğü içerik ile işaret ettiği adres
     * ayrışırdı.
     */
    const filtered: readonly Record<string, string>[] = [
      { "ucret-tipi": "HOURLY" },
      { isveren: "COMPANY" },
      { "min-ucret": "500" },
      { "max-ucret": "500" },
      { sigorta: "evet" },
      { deneyim: "hayir" },
    ];

    for (const searchParams of filtered) {
      const metadata = await generateMetadata({ searchParams: Promise.resolve(searchParams) });
      expect(metadata.robots, JSON.stringify(searchParams)).toEqual({
        index: false,
        follow: true,
      });
      expect(metadata.alternates?.canonical, JSON.stringify(searchParams)).toBe(
        `https://iskoala.com/is-ilanlari?${new URLSearchParams(searchParams)}`,
      );
    }
  });
});
