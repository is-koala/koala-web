import { expect, test } from "@playwright/test";

/**
 * İlan ayrıntısının tarayıcıdan görünen sözleşmesi.
 *
 * Gerçek bir ilan buradan sürülemez: `GET /jobs/{jobId}` çağrısı BFF'ten
 * çıkıyor ve `playwright.config.ts` API'yi var olmayan bir adrese bağlıyor,
 * yani `page.route` onu hiç görmüyor (`is-ilanlari.spec.ts` aynı sınırı
 * yazıyor). Ölçülebilen şey rotanın biçimi ve HTTP durumu.
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
