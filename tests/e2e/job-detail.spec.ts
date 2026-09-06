import { expect, test } from "@playwright/test";

test("bozuk ilan kimliği backend'e gitmeden bulunamadı durumunu gösterir", async ({ page }) => {
  const response = await page.goto("/is-ilanlari/gecersiz-ilan");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "İlan bulunamadı" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});
