import { expect, test } from "@playwright/test";

/**
 * Tanıtım başlığının oturumlu keşif yüzeyi.
 *
 * Kabuk sayfalarının kendisi burada sürülemez: BFF backend'e çıkıyor ve
 * Playwright o çağrıları görmüyor. `/api/session` tarayıcıdan sorulduğu için
 * taklit edilebilir; ölçülen şey kabuk bağlantısının oturumlu kromda
 * görünmesi ve rolüne göre adlanması (is-koala/koala-web#154).
 */

async function fulfillSession(
  page: import("@playwright/test").Page,
  body: Record<string, unknown>,
) {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(body),
    });
  });
}

test("çalışan oturumunda başlık Panelim ve çıkış bağlantılarını gösterir", async ({ page }) => {
  await fulfillSession(page, { authenticated: true, shell: "worker" });

  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "Panelim" })).toHaveAttribute("href", "/panel");
  await expect(nav.getByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
  // Uygulama bağlantısı ikincil ama duruyor.
  await expect(nav.getByRole("link", { name: "Uygulamayı aç" })).toHaveAttribute(
    "href",
    "/uygulamayi-ac",
  );
  await expect(nav.getByRole("link", { name: "Giriş yap" })).toHaveCount(0);
});

test("işveren oturumunda başlık İşveren panelim bağlantısını gösterir", async ({ page }) => {
  await fulfillSession(page, { authenticated: true, shell: "employer" });

  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "İşveren panelim" })).toHaveAttribute(
    "href",
    "/isveren",
  );
});

test("oturumsuz tanıtım başlığı kabuk bağlantılarını göstermez", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /panelim/i })).toHaveCount(0);
});
