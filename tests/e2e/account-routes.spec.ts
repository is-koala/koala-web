import { expect, test } from "@playwright/test";

const appScheme = process.env.NEXT_PUBLIC_APP_URL_SCHEME ?? "koala-dev";

test("hesap doğrulama biçimi bozuk bağlantıyı backend'e sormadan reddeder", async ({ page }) => {
  await page.goto("/hesap-dogrula?token=bir&token=iki");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();

  // Kayıt tokenı backend'de UUID; başka bir dize sorulmadan elenir.
  await page.goto("/hesap-dogrula?token=abc");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();

  await page.goto("/hesap-dogrula");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();
});

test("parola sıfırlama web formunu açar ve uygulamaya geçişi ikincil tutar", async ({ page }) => {
  await page.goto("/sifre-sifirla?token=reset%20token");

  await expect(page.getByRole("heading", { name: "Yeni parolanı belirle" })).toBeVisible();
  await expect(page.getByLabel("Yeni parola", { exact: true })).toBeVisible();
  await expect(page.getByText("bütün cihazlardaki oturumların kapanır")).toBeVisible();
  await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute(
    "href",
    `${appScheme}://sifre-sifirla?token=reset%20token`,
  );

  await page.goto("/sifre-sifirla");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();
});

test("parola belirleme kalıcı olarak hesap doğrulamaya 308 ile gider", async ({ request }) => {
  const response = await request.get("/sifre-belirle?token=abc", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toContain("/hesap-dogrula");
});

test("e-posta onayı altı haneli kod akışını anlatır", async ({ page }) => {
  await page.goto("/eposta-onayla");
  await expect(page.getByRole("heading", { name: "6 haneli kodunu gir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Uygulamayı aç" })).toHaveAttribute("href", "/uygulamayi-ac");
});
