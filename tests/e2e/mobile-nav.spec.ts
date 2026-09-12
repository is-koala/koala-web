import { expect, test } from "@playwright/test";

const mobileNavItems = [
  ["İş İlanları", "/is-ilanlari"],
  ["İş Arayanlar", "/is-arayanlar"],
  ["İşverenler", "/isverenler"],
  ["Nasıl Çalışır", "/nasil-calisir"],
  ["SSS", "/sss"],
  ["Hakkımızda", "/hakkimizda"],
  ["İletişim", "/iletisim"],
] as const;

const viewports = [
  { name: "390px", width: 390, height: 844 },
  { name: "820px", width: 820, height: 1180 },
] as const;

for (const viewport of viewports) {
  test.describe(`mobil ana menü (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("temel bağlantılar menüden erişilir ve Giriş ile Uygulamayı aç durur", async ({
      page,
    }) => {
      await page.goto("/");

      const nav = page.getByRole("navigation", { name: "Ana menü" });
      await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Uygulamayı aç" })).toBeVisible();

      await nav.getByRole("button", { name: "Menüyü aç" }).click();
      const dialog = page.getByRole("dialog", { name: "Menü" });
      await expect(dialog).toBeVisible();
      await expect(nav.getByRole("button", { name: "Menüyü aç" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      for (const [label, href] of mobileNavItems) {
        await expect(dialog.getByRole("link", { name: label })).toHaveAttribute("href", href);
      }
    });

    test("açık menü yatay taşmaz ve arka planı etkisizleştirir", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Menüyü aç" }).click();

      const dialog = page.getByRole("dialog", { name: "Menü" });
      await expect(dialog).toBeVisible();
      await expect(page.locator("main")).toHaveAttribute("inert", "");
      await expect(page.locator(".site-footer")).toHaveAttribute("inert", "");

      const overflowed = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflowed).toBe(false);

      const overlayBlocksHero = await page.evaluate(() => {
        const hero = document.querySelector(".home-hero a");
        if (!(hero instanceof HTMLElement)) return false;
        const box = hero.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + 12, box.top + 12);
        return Boolean(top?.closest("[role='dialog']"));
      });
      expect(overlayBlocksHero).toBe(true);
    });
  });
}
