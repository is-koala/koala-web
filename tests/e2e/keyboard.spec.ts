import { expect, test, type Locator, type Page } from "@playwright/test";

const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

test("tekrarlanan menüyü ilk klavye durağından atlar", async ({ page }) => {
  await page.goto("/is-ilanlari");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ana içeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("main#ana-icerik")).toBeFocused();
});

test("ilan süzgeci yalnız klavyeyle adres çubuğuna uygulanır", async ({ page }) => {
  await page.goto("/is-ilanlari");
  await fillWithKeyboard(page, page.getByLabel("Ne arıyorsun?"), "garson");
  await tabTo(page, page.getByRole("button", { name: "İlanları süz" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/is-ilanlari\?.*ara=garson/);
});

test("giriş ve kayıt ana eylemleri yalnız klavyeyle gönderilir", async ({ page }) => {
  await page.goto("/giris");
  await fillWithKeyboard(page, page.getByLabel("E-posta"), "aday@example.test");
  await fillWithKeyboard(page, page.getByLabel("Parola"), "parola-yer-tutucu");
  await tabTo(page, page.getByRole("button", { name: "Giriş yap" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();

  await page.goto("/kayit");
  await fillWithKeyboard(page, page.getByLabel("Ad", { exact: true }), "Ada");
  await fillWithKeyboard(page, page.getByLabel("Soyad"), "Yılmaz");
  await fillWithKeyboard(page, page.getByLabel("E-posta"), "ada@example.test");
  await tabTo(page, page.getByRole("button", { name: "Doğrulama bağlantısı gönder" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
});

test("ilan ayrıntısındaki başvuru eylemi klavyeyle giriş kapısına ulaşır", async ({ page }) => {
  await page.goto(`/is-ilanlari/${openJobId}`);
  await fillWithKeyboard(
    page,
    page.getByLabel("Başvuru notu (isteğe bağlı)"),
    "Etkinlik deneyimim var.",
  );
  await tabTo(page, page.getByRole("button", { name: "Başvuruyu gönder" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`/giris?next=%2Fis-ilanlari%2F${openJobId}`);
});

test("mobil menü yalnız klavyeyle açılır ve Escape ile kapanır", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Menüyü aç" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Menü" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Menü" }).getByRole("link", { name: "İş İlanları" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menü" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeFocused();
});

async function fillWithKeyboard(page: Page, field: Locator, value: string) {
  await tabTo(page, field);
  await page.keyboard.type(value);
}

async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 40; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Beklenen denetim 40 klavye durağında bulunamadı.");
}
