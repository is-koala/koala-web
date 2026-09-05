import { expect, test } from "@playwright/test";

for (const result of [{ status: "success", title: "Ödeme işlemi alındı" }, { status: "failed", title: "Ödeme tamamlanamadı" }] as const) {
  test(`${result.status} ödeme sonucu kullanıcıya açıklanır`, async ({ page }) => {
    await page.goto(`/payment/result?status=${result.status}&assignmentId=42`);
    await expect(page.getByRole("heading", { name: result.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", `koala-dev://payment-result?status=${result.status}&assignmentId=42`);
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
