import { expect, test } from "@playwright/test";

/**
 * Ana sayfa duman testi (is-koala/koala-web#155): v2 bölümleri sırasıyla
 * çiziliyor mu, çağrılar doğru rotaya gidiyor mu, sekmeler klavyeyle
 * dönüyor mu. Görsel doğruluk değil, yapı ölçülüyor.
 */
const sectionHeadings = [
  "Boş vaktini paraya çevir.",
  "Beş kategori, günlük işler.",
  "Kampüste başladı, kampüs için büyüyor.",
  "Günlük iş, tahmin işi olmasın.",
  "Sabah gördün, akşam kazandın.",
  "Buradan dokun, içini gez.",
  "Soruyu biz sormuyoruz, afiş soruyor.",
  "Tek uygulama, iki taraf.",
  "Erken deneyenler ne dedi?",
  "Merak edilenler",
  "Çıktığı gün haberin olsun.",
] as const;

test("ana sayfa v2 bölümlerini mockup sırasıyla çizer", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Boş vaktini paraya çevir." })).toBeVisible();
  for (const heading of sectionHeadings.slice(1)) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeAttached();
  }

  const order = await page.evaluate(() =>
    [...document.querySelectorAll("main h1, main h2")]
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter((text) => text.length > 0),
  );
  const positions = sectionHeadings.map((heading) => order.indexOf(heading));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((left, right) => left - right)).toEqual(positions);

  const ticker = page.locator(".mk-ticker");
  await expect(ticker).toBeVisible();
  // Şeritteki ₺ değerleri de örnek; işaret şeridin kendi içinde durmalı.
  await expect(ticker.getByText("Örnek ücretler", { exact: true })).toBeVisible();
  await expect(page.locator(".mk-stats")).toBeVisible();
  await expect(page.locator(".mk-map-card").getByText("Örnek", { exact: true })).toBeAttached();
  await expect(page.locator(".mk-job-grid").getByText("Örnek", { exact: true })).toHaveCount(5);
});

test("çağrılar gerçek rotalara ve sayfa içi çıpalara gider", async ({ page }) => {
  await page.goto("/");
  const main = page.locator("main");

  await expect(main.getByRole("link", { name: "Erken erişime katıl" }).first()).toHaveAttribute("href", "#erken-erisim");
  await expect(main.getByRole("link", { name: "Uygulamayı dene" })).toHaveAttribute("href", "#uygulama");
  await expect(main.getByRole("link", { name: "Başvur" })).toHaveAttribute("href", "/is-ilanlari");
  await expect(main.getByRole("link", { name: "Gerçek ilanlara bak" })).toHaveAttribute("href", "/is-ilanlari");
  await expect(main.getByRole("link", { name: "Hakkımızda" })).toHaveAttribute("href", "/hakkimizda");
  await expect(main.getByRole("link", { name: "Adım adım anlatım" })).toHaveAttribute("href", "/nasil-calisir");
  await expect(main.getByRole("link", { name: "Tüm sorular" })).toHaveAttribute("href", "/sss");
  await expect(main.getByRole("link", { name: "İş arayanlar sayfası" })).toHaveAttribute("href", "/is-arayanlar");
  await expect(page.locator("#erken-erisim")).toBeAttached();
  await expect(page.locator("#uygulama")).toBeAttached();

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "Uygulamayı aç" })).toHaveAttribute("href", "/uygulamayi-ac");
  await expect(nav.getByRole("link", { name: "Koala ana sayfa" })).toHaveAttribute("href", "/");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Destek formu" })).toHaveAttribute("href", "/iletisim");
  await expect(footer.getByRole("link", { name: "İş İlanları" })).toHaveAttribute("href", "/is-ilanlari");

  await main.getByRole("link", { name: "Gerçek ilanlara bak" }).click();
  await expect(page).toHaveURL(/\/is-ilanlari$/);
});

test("uygulama ekranları ve iki taraf sekmeleri klavyeyle döner", async ({ page }) => {
  await page.goto("/");

  const screens = page.getByRole("tablist", { name: "Uygulama ekranları" });
  await expect(screens.getByRole("tab")).toHaveCount(5);
  await expect(screens.getByRole("tab", { name: /Keşfet — harita/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("img", { name: "Uygulama ekranı: Keşfet — harita" })).toBeVisible();

  await screens.getByRole("tab", { name: /Keşfet — harita/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(screens.getByRole("tab", { name: /İş detayı/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("img", { name: "Uygulama ekranı: İş detayı" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("img", { name: "Uygulama ekranı: Profilim" })).toBeVisible();

  const sides = page.getByRole("tablist", { name: "Çalışan ya da işveren tarafı" });
  await expect(page.getByRole("heading", { level: 3, name: "Öğrenciysen: boş günün dolsun." })).toBeVisible();
  await sides.getByRole("tab", { name: "İşveren" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Yarın sabah için bir kişi mi lazım?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "İşverenler sayfası" })).toHaveAttribute("href", "/isverenler");
});

test("SSS akordeonu klavyeyle açılır ve erken erişim formu etiketli", async ({ page }) => {
  await page.goto("/");

  const first = page.locator("#sss details").first();
  await first.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("open", "");

  await expect(page.getByLabel("Adın")).toBeVisible();
  await expect(page.getByLabel("E-postan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Haber ver" })).toBeVisible();
});

test("diğer tanıtım sayfaları aynı bileşen setiyle çizilir", async ({ page }) => {
  for (const [path, heading, action] of [
    ["/is-arayanlar", "İş Arayanlar için Koala", "/is-ilanlari"],
    ["/isverenler", "İşverenler için Koala", "/isveren"],
    ["/nasil-calisir", "Koala Nasıl Çalışır?", "/is-ilanlari"],
    ["/hakkimizda", "Koala Hakkında", "/iletisim"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("main .mk-section").first()).toBeVisible();
    await expect(page.locator("main .button-primary").last()).toHaveAttribute("href", action);
  }

  await page.goto("/sss");
  await expect(page.getByRole("heading", { level: 1, name: "Sıkça Sorulan Sorular" })).toBeVisible();
  await expect(page.locator("main details")).toHaveCount(8);
});
