import { expect, test } from "@playwright/test";

test("/iletisim şirket kimliğini ve destek formunu gösterir", async ({ page }) => {
  const response = await page.goto("/iletisim");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Birlikte çözelim." })).toBeVisible();
  await expect(page.getByText("Şirket unvanı")).toBeVisible();
  await expect(page.getByText("KVKK veri sorumlusu başvuru adresi")).toBeVisible();
  await expect(page.getByRole("link", { name: "info@iskoala.com" }).first()).toBeVisible();
  await expect(page.getByLabel("Konu")).toBeVisible();
  await expect(page.getByLabel("Ad")).toBeVisible();
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await expect(page.getByLabel("Mesaj")).toBeVisible();
  await expect(page.locator("form").getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute(
    "href",
    "/kvkk-aydinlatma",
  );
});

test("/kvkk-aydinlatma KVKK başvuru adresini gösterir", async ({ page }) => {
  const response = await page.goto("/kvkk-aydinlatma");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Veri sorumlusu başvuru adresi" })).toBeVisible();
  await expect(page.getByText("KVKK veri sorumlusu başvuru adresi")).toBeVisible();
  await expect(page.getByRole("link", { name: "İletişim formu" })).toHaveAttribute(
    "href",
    "/iletisim",
  );
});
