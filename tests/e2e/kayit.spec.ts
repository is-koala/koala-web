import { expect, test } from "@playwright/test";

test("kayıt formu açılıyor ve boş gönderilemiyor", async ({ page }) => {
  await page.goto("/kayit");
  await expect(page.getByRole("heading", { name: "Kayıt ol" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "İş arıyorum" })).toBeChecked();

  await page.getByRole("button", { name: "Doğrulama bağlantısı gönder" }).click();

  await expect(page).toHaveURL(/\/kayit$/);
  const nameIsValid = await page
    .getByLabel("Ad", { exact: true })
    .evaluate((field) => (field as HTMLInputElement).checkValidity());
  expect(nameIsValid).toBe(false);
});

test("parola hatırlatma formu tek alanla açılıyor", async ({ page }) => {
  await page.goto("/sifre-unuttum");
  await expect(page.getByRole("heading", { name: "Parolanı mı unuttun?" })).toBeVisible();
  await expect(page.getByLabel("E-posta")).toBeVisible();
});

test("kayıt ve parola sayfaları indekslenmez", async ({ request }) => {
  for (const path of ["/kayit", "/sifre-unuttum", "/hesap-dogrula", "/sifre-sifirla"]) {
    const response = await request.get(path);
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  }

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /kayit");
  expect(robots).toContain("Disallow: /sifre-unuttum");
});
