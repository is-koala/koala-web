import { expect, test } from "@playwright/test";

const appScheme = process.env.NEXT_PUBLIC_APP_URL_SCHEME ?? "koala-dev";

test("hesap doğrulama canonical host üretir ve geçersiz tokenı reddeder", async ({ page }) => {
  await page.goto("/hesap-dogrula?token=abc");
  await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", `${appScheme}://hesap-dogrula?token=abc`);
  await page.goto("/hesap-dogrula?token=bir&token=iki");
  await expect(page.getByRole("heading", { name: "Bağlantı geçersiz" })).toBeVisible();
});

test("parola sıfırlama canonical host üretir ve tokensız durumda güvenle kalır", async ({ page }) => {
  await page.goto("/sifre-sifirla?token=reset%20token");
  await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", `${appScheme}://sifre-sifirla?token=reset%20token`);
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

test("ölçümleme isteği yalnız açık rızadan sonra ve tokensız gider", async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics/events")) {
      analyticsRequests.push(request.postData() ?? "");
    }
  });

  await page.goto("/hesap-dogrula?token=secret-token");
  await expect(page.getByRole("region", { name: "Çerez tercihleri" })).toBeVisible();
  expect(analyticsRequests).toEqual([]);

  await page.getByRole("button", { name: "Ölçümlemeye izin ver" }).click();
  await expect.poll(() => analyticsRequests.length).toBe(1);
  expect(analyticsRequests[0]).toBe(JSON.stringify({ event: "handoff_viewed", platform: "ios" }));
  expect(analyticsRequests[0]).not.toContain("secret-token");
});

test("www alan adı ilişkilendirme belgelerini apex'e yönlendirmez", async ({
  request,
}) => {
  for (const path of [
    "/.well-known/apple-app-site-association",
    "/.well-known/assetlinks.json",
  ]) {
    const response = await request.get(path, {
      headers: { Host: "www.iskoala.com" },
      maxRedirects: 0,
    });

    expect(response.status()).not.toBe(301);
    expect(response.headers().location).toBeUndefined();
  }
});
