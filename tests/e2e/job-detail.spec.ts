import { expect, test } from "@playwright/test";

const expiredOpenJobId = "f62dc02c-70df-4e85-b1df-17b799ba17c1";

/**
 * İlan ayrıntısının tarayıcıdan görünen sözleşmesi.
 *
 * Playwright API fikstürü tek, sabit bir süresi dolmuş OPEN ilan sunuyor;
 * böylece BFF üzerinden çıkan gerçek HTTP/HTML davranışı deterministik biçimde
 * ölçülüyor. Geçersiz UUID ise backend'e çıkmadan rota sınırında 404 oluyor.
 */

test("bozuk ilan kimliği backend'e gitmeden 404 döner", async ({ page }) => {
  /*
   * Durum kodu iddianın kendisi. Sayfa daha önce kendi "bulunamadı" kartını
   * 200 ile çiziyordu; yanındaki `loading.tsx` segmenti bir Suspense sınırına
   * soktuğu için kabuk erken akıtılıyor ve `notFound()` 404 döndüremiyordu
   * (is-koala/koala-web#94). `loading.tsx` kalktı, durum artık gerçek.
   */
  const response = await page.goto("/is-ilanlari/gecersiz-ilan");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Bu sayfa burada değil." })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});

test("süresi dolmuş OPEN ilan noindex taşır, yapısal veri ve başvuru göstermez", async ({
  page,
}) => {
  const response = await page.goto(`/is-ilanlari/${expiredOpenJobId}`);

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Başvuruyu gönder" })).toHaveCount(0);
  await expect(page.getByText("Bu ilanın süresi doldu ve yeni başvuru almıyor.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Benzer ilanları gör" })).toHaveAttribute(
    "href",
    "/is-ilanlari",
  );
});
