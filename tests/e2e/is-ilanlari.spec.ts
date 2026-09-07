import { expect, test } from "@playwright/test";

/**
 * Herkese açık ilan listesinin tarayıcıdan görünen sözleşmesi.
 *
 * Gerçek ilanlar buradan sürülemez: `GET /jobs` çağrısı BFF'ten çıkıyor ve
 * `playwright.config.ts` API'yi var olmayan bir adrese bağlıyor, yani
 * `page.route` onu hiç görmüyor (`uygulama.spec.ts` aynı sınırı yazıyor).
 * Ölçülebilen ve kırılması en pahalı olan davranış bu: sayfa adres
 * çubuğundaki her girdiyle ayakta kalıyor mu, ve süzgeç JavaScript'siz
 * çalışıyor mu.
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
  // görünüyorlar. (Backend erişilemez olduğu için liste yerine hata durumu
  // çiziliyor; ölçülen şey listenin içeriği değil, sayfanın SSR'da tam
  // kurulduğu ve formun gerçek bir HTML formu olduğu.)
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "İş İlanları" })).toBeVisible();

  await page.getByLabel("Ne arıyorsun?").fill("garson");
  await page.getByRole("button", { name: "İlanları süz" }).click();

  // Seçim adres çubuğuna yazıldı: bağlantı paylaşılabilir ve indekslenebilir.
  await expect(page).toHaveURL(/\/is-ilanlari\?.*ara=garson/);
  await expect(page.getByLabel("Ne arıyorsun?")).toHaveValue("garson");

  await context.close();
});

test("liste okunamadığında boş listeden ayrı bir hata durumu çiziliyor", async ({ page }) => {
  // Backend erişilemez; boş bir liste ile başarısız bir yükleme aynı
  // görünmemeli (`AGENTS.md` § "Ekran durumları").
  await page.goto("/is-ilanlari");

  // `getByRole("alert")` Next'in kendi rota duyurucusunu da yakalıyor; ölçülen
  // şey hata kartının kendisi.
  await expect(page.locator(".state-card-error")).toBeVisible();
  await expect(page.getByText("Henüz ilan yok")).toHaveCount(0);
  await expect(page.getByText("Bu süzgeçlere uyan ilan yok")).toHaveCount(0);
});

test("liste sayfası arama motorlarına kapalı değil", async ({ request }) => {
  const robots = await request.get("/robots.txt");

  expect(await robots.text()).not.toContain("/is-ilanlari");
});
