import { expect, test } from "@playwright/test";

test("hesap doğrulama canonical host üretir ve geçersiz tokenı reddeder", async ({ page }) => {
  await page.goto("/hesap-dogrula?token=abc");
  await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", "koala-dev://hesap-dogrula?token=abc");
  await page.goto("/hesap-dogrula?token=bir&token=iki");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();
});

test("parola sıfırlama canonical host üretir ve tokensız durumda güvenle kalır", async ({ page }) => {
  await page.goto("/sifre-sifirla?token=reset%20token");
  await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", "koala-dev://sifre-sifirla?token=reset%20token");
  await page.goto("/sifre-sifirla");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();
});

test("parola belirleme geçici olarak hesap doğrulamaya 308 ile gider", async ({ request }) => {
  const response = await request.get("/sifre-belirle?token=abc", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toContain("/hesap-dogrula");
});

test("e-posta onayı altı haneli kod akışını anlatır", async ({ page }) => {
  await page.goto("/eposta-onayla");
  await expect(page.getByRole("heading", { name: "6 haneli kodunu gir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Uygulamayı aç" })).toHaveAttribute("href", "/uygulamayi-ac");
});
