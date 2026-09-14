import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

const stablePublicRoutes = [
  ["ana sayfa", "/", "Boş vaktini paraya çevir."],
  ["ilan listesi", "/is-ilanlari", "İş İlanları"],
  ["ilan ayrıntısı", `/is-ilanlari/${openJobId}`, "Etkinlik görevlisi"],
  ["giriş", "/giris", "Giriş yap"],
  ["kayıt", "/kayit", "Kayıt ol"],
] as const;

test.describe("erişilebilirlik taraması", () => {
  test.setTimeout(process.env.CI ? 90_000 : 60_000);

  for (const [name, path, heading] of stablePublicRoutes) {
    test(`${name} ciddi veya kritik erişilebilirlik ihlali taşımıyor`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      if (path === "/is-ilanlari") {
        await expect(page.getByRole("link", { name: "Etkinlik görevlisi" })).toBeVisible();
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const blockingViolations = results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      );

      expect(blockingViolations).toEqual([]);
    });
  }

  test("açık mobil menü ciddi veya kritik erişilebilirlik ihlali taşımıyor", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await expect(page.getByRole("dialog", { name: "Menü" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blockingViolations = results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );

    expect(blockingViolations).toEqual([]);
  });

  test("ilan listesi ve ayrıntısı Maps JavaScript yüklemez", async ({ page }) => {
    const mapsRequests: string[] = [];
    page.on("request", (request) => {
      if (/maps\.googleapis|maps\.gstatic/.test(request.url())) {
        mapsRequests.push(request.url());
      }
    });

    await page.goto("/is-ilanlari");
    await expect(page.getByRole("heading", { level: 1, name: "İş İlanları" })).toBeVisible();
    await page.goto(`/is-ilanlari/${openJobId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();

    expect(mapsRequests).toEqual([]);
  });
});
