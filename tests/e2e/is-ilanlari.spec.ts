import { expect, test } from "@playwright/test";

/**
 * Herkese açık ilan listesinin tarayıcıdan görünen sözleşmesi.
 *
 * Test API'si varsayılan `GET /jobs` için sabit bir açık ilan döndürüyor;
 * hata durumu `?ara=__backend_failure__` ile süzülüyor. Ölçülebilen ve
 * kırılması en pahalı davranış bu: sayfa adres çubuğundaki her girdiyle
 * ayakta kalıyor mu, süzgeç JavaScript'siz çalışıyor mu, ve boş listeden
 * ayrı bir hata durumu duruyor mu.
 */

test("adres çubuğundaki bozuk sayfa ve sıralama değerleri sayfayı kırmaz", async ({ page }) => {
  // `PageableSanitizer.rejectUnknownSort` tanımadığı alanı 400 ile reddediyor;
  // rastgele parametrelerle gelen bir arama motoru botu SSR sayfasını
  // çökertmemeli. Ham girdi sunucuya hiç gitmediği için hepsi 200 dönüyor.
  for (const query of [
    "",
    "?sayfa=abc",
    "?sayfa=-1",
    "?sayfa=0",
    "?sayfa=999999",
    "?sirala=password,desc",
    "?kategori=DROP%20TABLE&il=34&tur=HAFTALIK",
  ]) {
    const response = await page.goto(`/is-ilanlari${query}`);

    expect(response?.status(), query).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "İş İlanları" })).toBeVisible();
  }
});

test("sayfa JavaScript kapalıyken de çiziliyor ve süzgeç GET ile URL'ye yazıyor", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/is-ilanlari");

  // Kabuk ve süzgeç sunucudan geliyor: istemci JavaScript'i olmadan da
  // görünüyorlar.
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "İş İlanları" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Etkinlik görevlisi" })).toBeVisible();

  await page.getByLabel("Ne arıyorsun?").fill("garson");
  await page.getByRole("button", { name: "İlanları süz" }).click();

  // Seçim adres çubuğuna yazıldı: bağlantı paylaşılabilir ve indekslenebilir.
  await expect(page).toHaveURL(/\/is-ilanlari\?.*ara=garson/);
  await expect(page.getByLabel("Ne arıyorsun?")).toHaveValue("garson");

  await context.close();
});

test("liste okunamadığında boş listeden ayrı bir hata durumu çiziliyor", async ({ page }) => {
  // Fikstürün açık hata girdisi, boş bir liste ile başarısız bir yüklemenin
  // aynı görünmediğini korur (`AGENTS.md` § "Ekran durumları").
  await page.goto("/is-ilanlari?ara=__backend_failure__");

  // `getByRole("alert")` Next'in kendi rota duyurucusunu da yakalıyor; ölçülen
  // şey hata kartının kendisi.
  await expect(page.locator(".state-card-error")).toBeVisible();
  await expect(page.getByText("Henüz ilan yok")).toHaveCount(0);
  await expect(page.getByText("Bu süzgeçlere uyan ilan yok")).toHaveCount(0);
});

test("liste sayfası arama motorlarına kapalı değil", async ({ request }) => {
  const robots = await request.get("/robots.txt");

  // Durum kodu da ölçülüyor: `robots.txt` 404 dönseydi gövde bir HTML hata
  // sayfası olurdu, o da `/is-ilanlari` içermez ve iddia yanlış sebeple yeşil
  // kalırdı — dosyanın sunulduğunu değil, var olmadığını kanıtlamış olurdu.
  expect(robots.status()).toBe(200);
  expect(await robots.text()).not.toContain("/is-ilanlari");
});

test("yakınlık ve tarih süzgeci sahte backend'e sort=distance ve startFrom gider", async ({
  page,
}) => {
  await page.goto(
    "/is-ilanlari?ara=__assert_distance_sort__&konum=41.008238,28.978359&sirala=en-yakin&tarih=2026-09-20",
  );

  await expect(page.getByRole("article", { name: "Etkinlik görevlisi" })).toBeVisible();
  const card = page.getByRole("article", { name: "Etkinlik görevlisi" });
  await expect(card.getByText("Uzaklık")).toBeVisible();
  await expect(card.getByText("yaklaşık 3,4 km")).toBeVisible();
  await expect(page.locator(".state-card-error")).toHaveCount(0);
});
