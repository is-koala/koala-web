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

test("yayındaki ilan yayın tarihini ve işveren güven kartını script'siz HTML'de taşır", async ({
  page,
}) => {
  /*
   * Kart sunucuda çiziliyor (is-koala/koala-web#166): `GET /users/{id}/employer-stats`
   * ilanla aynı oturumsuz kademeden okunuyor ve içerik ilk HTML'de. İddia
   * DOM'a bakıyor; hidrasyon sonrası gelen bir kart bu sayfada zaten
   * indekslenmezdi.
   */
  const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
  await page.goto(`/is-ilanlari/${openJobId}`);

  const facts = page.locator('dl[aria-label="İlan özeti"]');
  await expect(facts).toContainText("Yayın tarihi");
  await expect(facts).toContainText("30 Ağu 2026");

  const trust = page.locator('dl[aria-label="İşveren güven kartı"]');
  await expect(trust).toContainText("Açtığı ilan");
  await expect(trust).toContainText("12");
  await expect(trust).toContainText("Tamamlanan iş");
  await expect(trust).toContainText("9");
  await expect(trust).toContainText("4.6 / 5 · 7 değerlendirme");
  await expect(trust).toContainText("Mart 2025");
});

test("yayındaki ilan ziyaretçiye kazancı gösterir, hizmet bedeli ile işveren toplamını göstermez", async ({
  page,
}) => {
  /*
   * Backend 0.9.27 herkese açık görünümde `serviceFeeRate/serviceFeeAmount/
   * employerTotal` null gönderiyor (is-koala/koala-backend#304); sahte backend
   * oturumsuz okuyucuya aynı gövdeyi veriyor. Kazanç kaybolmamalı
   * (is-koala/koala-web#181) ve olmayan iki satır uydurulmamalı.
   */
  const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
  await page.goto(`/is-ilanlari/${openJobId}`);

  const facts = page.locator('dl[aria-label="İlan özeti"]');
  await expect(facts).toContainText("günlük 1.250,00 ₺");
  await expect(page.locator("body")).not.toContainText("Kazanç bilgisi paylaşılmadı");

  const breakdown = page.locator('dl[aria-label="Ücret dökümü"]');
  await expect(breakdown).toContainText("Çalışan ücreti");
  await expect(breakdown).toContainText("1.250,00 ₺");
  await expect(page.locator("body")).not.toContainText("Koala hizmet bedeli");
  await expect(page.locator("body")).not.toContainText("İşveren toplamı");
  await expect(page.locator("body")).not.toContainText("1.500,00");
});
