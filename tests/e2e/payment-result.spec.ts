import { expect, test } from "@playwright/test";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const expectedPrivateHeaders = [
  ["x-robots-tag", "noindex, nofollow, noarchive"],
  ["referrer-policy", "no-referrer"],
  ["x-content-type-options", "nosniff"],
] as const;

function expectPrivateHeaders(headers: Record<string, string>) {
  for (const [name, value] of expectedPrivateHeaders) {
    expect(headers[name], name).toBe(value);
  }
}

for (const status of ["success", "failed"] as const) {
  test(`${status} iddialı mobil dönüş oturumsuzken uygulama aktarımını korur`, async ({ page }) => {
    const path = `/payment/result?status=${status}&assignmentId=${assignmentId}`;
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    expectPrivateHeaders(response!.headers());
    await expect(page.getByRole("link", { name: "Uygulamada aç" })).toBeVisible();
  });
}

test("ödeme sonucu BFF hata yanıtı private güvenlik başlıklarını korur", async ({
  request,
}) => {
  const response = await request.get(`/api/payments/${assignmentId}/result`);

  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expectPrivateHeaders(response.headers());
});

test("robots.txt ödeme sonucu API adresini crawler wildcard'ıyla kapatır", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");

  const robots = await response.text();
  expect(robots).toContain("Disallow: /api/payments/*/result");
  expect(robots).not.toContain(":assignmentId");
});

test("bozuk ödeme dönüşü nötr mesaj gösterir", async ({ page }) => {
  await page.goto("/payment/result?status=unknown");
  await expect(page.getByRole("heading", { name: "Ödeme sonucu okunamadı" })).toBeVisible();
});

test("yinelenen ödeme parametresi çökmek yerine geçersiz sayılır", async ({ page }) => {
  const response = await page.goto("/payment/result?status=success&assignmentId=bir&assignmentId=iki");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Ödeme sonucu okunamadı" })).toBeVisible();
});
