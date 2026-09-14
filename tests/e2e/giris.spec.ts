import { expect, test } from "@playwright/test";

test("giriş sayfası açılıyor ve boş form gönderilemiyor", async ({ page }) => {
  await page.goto("/giris");
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();

  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(page).toHaveURL(/\/giris$/);
  const emailIsValid = await page
    .getByLabel("E-posta")
    .evaluate((field) => (field as HTMLInputElement).checkValidity());
  expect(emailIsValid).toBe(false);
});

test("dönüş hedefi yalnız site içi yollarda taşınır", async ({ page }) => {
  await page.goto("/giris?next=%2Fpanel%2Fislerim%3Ffiltre%3Dacik");
  await expect(page.locator("input[name='next']")).toHaveValue("/panel/islerim?filtre=acik");

  // Site dışı hedef düşer; gizli alan boş kalır ve giriş sonrası hedefi rol
  // seçer (çalışan `/panel`, işveren `/isveren`, is-koala/koala-web#154).
  for (const hostile of ["https%3A%2F%2Fkotu.example", "%2F%2Fkotu.example", "%2F%5Ckotu.example"]) {
    await page.goto(`/giris?next=${hostile}`);
    await expect(page.locator("input[name='next']")).toHaveValue("");
  }
});

test("çıkış sayfası oturumu kapatan bir form sunar", async ({ page }) => {
  await page.goto("/cikis");
  await expect(page.getByRole("button", { name: "Çıkış yap" })).toBeVisible();
});

test("giriş ve çıkış adresleri indekslenmez", async ({ request }) => {
  for (const path of ["/giris", "/cikis"]) {
    const response = await request.get(path);
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  }

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /giris");
  expect(robots).toContain("Disallow: /cikis");
});
