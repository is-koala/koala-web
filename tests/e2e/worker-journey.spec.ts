import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

/**
 * İş arayanın web'deki kritik yolu (is-koala/koala-web#154): kayıtlı çalışan
 * ilanı bulur, başvurur ve başvurusunu panelinde görür. Backend sahte
 * (`tests/support/e2e-backend.mjs`); oturum çerezleri test anahtarıyla
 * kurulur, böylece her test kendi başvuru listesini görür.
 */

test.beforeEach(async ({ context, request }, testInfo) => {
  const stateKey = stateKeyFor(testInfo);
  const reset = await request.post(`${backendURL}/__test__/reset?key=${stateKey}`);
  expect(reset.ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
});

test("kayıtlı çalışan ilanı bulur, başvurur ve başvurusunu panelinde görür", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/is-ilanlari");
  await expect(page.getByText("1 ilan bulundu")).toBeVisible();
  await page.getByRole("link", { name: /Etkinlik görevlisi/ }).click();

  await expect(page).toHaveURL(`/is-ilanlari/${openJobId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();
  await page.getByLabel("Başvuru notu (isteğe bağlı)").fill("  Hafta sonu müsaitim.  ");
  await page.getByRole("button", { name: "Başvuruyu gönder" }).click();

  await expect(page).toHaveURL("/panel/basvurularim");
  const card = page.getByRole("article", { name: "Etkinlik görevlisi" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Hafta sonu müsaitim.");

  const recorded = await (
    await request.get(`${backendURL}/__test__/application-requests?key=${stateKeyFor(testInfo)}`)
  ).json();
  expect(recorded).toEqual([
    {
      method: "POST",
      path: `/jobs/${openJobId}/applications`,
      body: { notes: "Hafta sonu müsaitim." },
      authorization: `Bearer access-${stateKeyFor(testInfo)}`,
      deviceId,
    },
  ]);

  // Panel kökü giriş sonrası iniş yeri: başlangıç kartı ilanlara geri götürür.
  await page.goto("/panel");
  await expect(page.getByRole("heading", { level: 1, name: "Merhaba E2E" })).toBeVisible();
  await expect(page.getByRole("link", { name: "İlanlara göz at" })).toHaveAttribute(
    "href",
    "/is-ilanlari",
  );
});

test("panel bölümleri gerçek sayfalarla açılır; bilinmeyen adres 404 kalır", async ({ page }) => {
  await page.goto("/panel/bildirimler");
  await expect(page.getByRole("heading", { level: 1, name: "Bildirimler" })).toBeVisible();
  await expect(page.getByText("Henüz bildirimin yok.")).toBeVisible();

  await page.goto("/panel/kazanclarim");
  await expect(page.getByRole("heading", { level: 1, name: "Kazançlarım" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hesap ekle" })).toBeVisible();

  await page.goto("/panel/profil");
  await expect(page.getByRole("heading", { level: 1, name: "Profilim" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kazandığın rozetler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aralık ekle" })).toBeVisible();
  // Kimliği doğrulanmış çalışanın adı kilitli.
  await expect(page.getByText("Kimliğin doğrulandığı için ad ve soyad buradan değiştirilemez.")).toBeVisible();

  const missing = await page.goto("/panel/olmayan-bolum");
  expect(missing?.status()).toBe(404);
});

test("konum süzgeci kartta uzaklık yazar; harita görünümü anahtarsız ortamda yer tutucu çizer", async ({
  page,
}) => {
  // Dinleyici gezinmeden ÖNCE: anahtarsız ortamda harita görünümü de liste
  // görünümü de Maps JavaScript'i hiç istememeli.
  const mapsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("maps.googleapis.com")) mapsRequests.push(request.url());
  });

  await page.goto("/is-ilanlari?konum=41.008238,28.978359&mesafe=10&sirala=en-yakin&gorunum=harita");

  await expect(page.getByText("Harita bu ortamda kapalı")).toBeVisible();
  const card = page.getByRole("article", { name: "Etkinlik görevlisi" });
  await expect(card).toContainText("Uzaklık");
  await expect(card).toContainText(/yaklaşık \d+(,\d)? km/);
  await expect(page.getByRole("option", { name: "Önce en yakın" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Konumuma yakın süzgecini kaldır" })).toBeVisible();
  await expect(page.getByRole("link", { name: "10 km çevre süzgecini kaldır" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(mapsRequests).toEqual([]);
  await page.getByRole("link", { name: "Liste" }).click();
  await expect(page).toHaveURL(/\/is-ilanlari\?konum=/);
  expect(mapsRequests).toEqual([]);
});

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}
