import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/**
 * İşveren ayrıntı yüzeyleri (is-koala/koala-web#166).
 *
 * Sahte backend (`tests/support/e2e-backend.mjs`) aynı ilanı hem herkese açık
 * hem oturumlu uçtan veriyor; işverenin ilan sayfası tanıtımla aynı gövdeyi
 * çizmeli. Emanete alınmış atamanın tek başarılı ödeme denemesi çizelgeye
 * "Ödeme emanete alındı" damgasını veriyor; işçi kartı aday dosyasına gidiyor.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";
const completedAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f63";
const assignmentWorkerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";

test.beforeEach(async ({ context, request }, testInfo) => {
  const stateKey = stateKeyFor(testInfo);
  const reset = await request.post(`${backendURL}/__test__/reset?key=${stateKey}`);
  expect(reset.ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: accessTokenFor(stateKey), url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
});

test("işverenin ilan sayfası ilanın tam görünümünü ve işveren eylemlerini çizer", async ({ page }) => {
  await page.goto(`/isveren/ilan/${openJobId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();

  const facts = page.locator('dl[aria-label="İlan özeti"]');
  await expect(facts).toContainText("20 Eylül 2026, 09:00–18:00");
  await expect(facts).toContainText("Kadıköy, İstanbul");
  await expect(facts).toContainText("1 / 4 kişi işe alındı");
  await expect(facts).toContainText("Yayın tarihi");
  await expect(page.getByText("Festival alanında misafirleri karşıla.")).toBeVisible();
  await expect(page.getByText("Kıyafet: Siyah kıyafet")).toBeVisible();
  await expect(page.locator('dl[aria-label="Ücret dökümü"]')).toContainText("1.500,00 ₺");
  await expect(page.getByRole("link", { name: "Başvuruları gör" })).toHaveAttribute(
    "href",
    `/isveren/ilan/${openJobId}/basvurular`,
  );
});

test("atama çizelgesi ödeme damgasını taşır, işçi kartı aday dosyasına gider", async ({ page }) => {
  await page.goto(`/isveren/atama/${paidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();

  const timeline = page.getByRole("list", { name: "Atama zaman çizelgesi" });
  await expect(timeline).toContainText("Ödeme emanete alındı");
  await expect(timeline).toContainText("2 Eyl 2026 17:30");

  const worker = page.getByTestId("assignment-worker");
  await expect(worker).toContainText("Ayşe Yılmaz");
  await worker.getByRole("link", { name: "Aday dosyasını aç" }).click();

  await expect(page).toHaveURL(`/isveren/aday/${assignmentWorkerId}`);
  await expect(page.getByRole("heading", { name: "Ayşe Yılmaz" })).toBeVisible();
  await expect(page.getByText("4.7 / 5 · 3 değerlendirme")).toBeVisible();
  await expect(page.getByRole("list", { name: "Rozetler" })).toContainText("Dakik");
  await expect(page.getByText("Dakik ve güler yüzlü.")).toBeVisible();
});

/**
 * İşçiyi değerlendirme (is-koala/koala-web#173). Form yalnız tamamlanmış
 * atamada; yıldızlar klavyeyle seçilebilen bir radyo grubu; gönderim sahte
 * backend'e `POST /job-assignments/{id}/reviews` olarak düşer ve başarı
 * sonrası form kapanıp "Değerlendirmeniz: ★4 · yorum" yazılır. Aynı atamaya
 * ikinci gönderim 409 `REVIEW_ALREADY_REVIEWED` ile "zaten değerlendirdiniz"
 * durumuna varır.
 */
test("tamamlanmamış atamada değerlendirme formu yok", async ({ page }) => {
  await page.goto(`/isveren/atama/${paidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "İşçiyi değerlendir" })).toHaveCount(0);
});

test("tamamlanan atamada işçi yıldızla değerlendirilir, ikinci deneme 409'a düşer", async ({ page, request }, testInfo) => {
  await page.goto(`/isveren/atama/${completedAssignmentId}`);
  await expect(page.getByRole("heading", { name: "İşçiyi değerlendir" })).toBeVisible();

  const group = page.getByRole("group", { name: "Puan" });
  await expect(group.getByRole("radio")).toHaveCount(5);
  await group.getByRole("radio", { name: "4 yıldız" }).check();
  await expect(group.getByText("4 / 5")).toBeVisible();
  await page.getByLabel("Yorum (isteğe bağlı)").fill("Dakik ve güler yüzlü.");
  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();

  const summary = page.getByTestId("assignment-review-summary");
  await expect(summary).toContainText("Değerlendirmeniz: ★4 · Dakik ve güler yüzlü.");
  await expect(page.getByRole("button", { name: "Değerlendirmeyi gönder" })).toHaveCount(0);

  const reviews = await request.get(`${backendURL}/__test__/reviews?key=${stateKeyFor(testInfo)}`);
  expect(await reviews.json()).toMatchObject([
    { assignmentId: completedAssignmentId, rating: 4, comment: "Dakik ve güler yüzlü.", anonymous: false },
  ]);

  // Atama satırı yazarın değerlendirmesini taşımıyor; yeniden açılan sayfada
  // form geri gelir ve backend'in 409'u formu "zaten değerlendirdiniz"e çevirir.
  await page.reload();
  await page.getByRole("group", { name: "Puan" }).getByRole("radio", { name: "5 yıldız" }).check();
  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(page.getByTestId("assignment-review-existing")).toContainText("Bu atamayı daha önce değerlendirdiniz.");
  await expect(page.getByRole("button", { name: "Değerlendirmeyi gönder" })).toHaveCount(0);
});

function stateKeyFor(testInfo: TestInfo): string {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}

function accessTokenFor(stateKey: string): string {
  return `access-${stateKey}`;
}
