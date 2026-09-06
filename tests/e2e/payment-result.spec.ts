import { expect, test } from "@playwright/test";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

for (const status of ["success", "failed"] as const) {
  test(`${status} iddialı mobil dönüş oturumsuzken uygulama aktarımını korur`, async ({ page }) => {
    const path = `/payment/result?status=${status}&assignmentId=${assignmentId}`;
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "Uygulamada aç" })).toBeVisible();
  });
}

test("bozuk ödeme dönüşü nötr mesaj gösterir", async ({ page }) => {
  await page.goto("/payment/result?status=unknown");
  await expect(page.getByRole("heading", { name: "Ödeme sonucu okunamadı" })).toBeVisible();
});

test("yinelenen ödeme parametresi çökmek yerine geçersiz sayılır", async ({ page }) => {
  const response = await page.goto("/payment/result?status=success&assignmentId=bir&assignmentId=iki");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Ödeme sonucu okunamadı" })).toBeVisible();
});
