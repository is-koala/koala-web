import { expect, test } from "@playwright/test";

/**
 * Tanıtım başlığının oturumlu keşif yüzeyi.
 *
 * Kabuk sayfalarının kendisi burada sürülemez: BFF backend'e çıkıyor ve
 * Playwright o çağrıları görmüyor. `/api/session` tarayıcıdan sorulduğu için
 * taklit edilebilir; ölçülen şey bağlantıların oturumlu kromda görünmesi.
 */

test("oturumlu tanıtım başlığı İşlerim ve Şirketim bağlantılarını gösterir", async ({
  page,
}) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ authenticated: true }),
    });
  });

  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "İşlerim" })).toHaveAttribute(
    "href",
    "/panel/islerim",
  );
  await expect(nav.getByRole("link", { name: "Şirketim" })).toHaveAttribute(
    "href",
    "/isveren/sirket",
  );
  await expect(nav.getByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
});

test("oturumsuz tanıtım başlığı kabuk bağlantılarını göstermez", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "İşlerim" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Şirketim" })).toHaveCount(0);
});
