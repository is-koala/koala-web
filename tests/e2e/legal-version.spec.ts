import { expect, test } from "@playwright/test";

test.describe("sürümlü yasal metin rotası", () => {
  for (const route of [
    {
      name: "bilinmeyen slug",
      path: "/sir-112-yanita-girmemeli/v/1.0",
      untrustedInput: "sir-112-yanita-girmemeli",
    },
    {
      name: "bilinmeyen sürüm",
      path: "/cerez-politikasi/v/9.9",
      untrustedInput: "9.9",
    },
  ]) {
    test(`${route.name} gerçek 404 ve noindex döner`, async ({ page }) => {
      const response = await page.goto(route.path);

      expect(response?.status()).toBe(404);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expect(
        page.getByRole("heading", { name: "Bu sayfa burada değil." }),
      ).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain(
        route.untrustedInput,
      );
    });
  }

  for (const route of [
    {
      name: "güncel sürüm",
      path: "/cerez-politikasi/v/1.1",
      heading: "Çerez Politikası",
    },
    {
      name: "tarihsel sürüm",
      path: "/cerez-politikasi/v/1.0",
      heading: "Çerez Politikası",
    },
  ]) {
    test(`${route.name} erişilebilir kalır`, async ({ page }) => {
      const response = await page.goto(route.path);

      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading }),
      ).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }
});
