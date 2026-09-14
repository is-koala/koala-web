import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";
const completedAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f63";

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

test("iş ayrıntısı işvereni, ilan bilgilerini ve ödeme damgasını gösterir; liste ve kazanç satırları işi adlandırır", async ({
  page,
}) => {
  // İşveren kimliği ve zaman çizelgesi (is-koala/koala-web#165). Sahte backend
  // şirket ilanı veriyor: kart şirket adı + web sitesi, rozet "Şirket ilanı".
  await page.goto(`/panel/is/${paidAssignmentId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();

  const employer = page.getByTestId("work-employer");
  await expect(employer).toContainText("Şirket");
  await expect(employer).toContainText("Koala Etkinlik");
  await expect(employer.getByRole("link", { name: "Web sitesi" })).toHaveAttribute(
    "href",
    "https://koala.example",
  );
  await expect(page.getByText("Şirket ilanı")).toBeVisible();
  await expect(page.getByText("1 / 4 kişi")).toBeVisible();
  await expect(page.getByText("İlan tarihi")).toBeVisible();

  const timeline = page.getByRole("list", { name: "Atama zaman çizelgesi" });
  await expect(timeline).toContainText("Atama oluşturuldu");
  await expect(timeline).toContainText("Ödeme emanete alındı");
  await expect(timeline.locator("time[datetime='2026-09-02T14:30:00Z']")).toBeVisible();

  // İşlerim kartı teklif anını yazar.
  await page.goto("/panel/islerim");
  await expect(page.getByText("Teklif").first()).toBeVisible();
  await expect(page.locator("time[datetime='2026-09-01T09:00:00Z']").first()).toBeVisible();

  // Kazançlar satırı işi adlandırır; ad atama listesinden eşlenir. 0.9.25
  // öncesi biçimdeki satırda hakediş ayrıntısı tireyle çizilir (#179).
  await page.goto("/panel/kazanclarim");
  const payoutRow = page.getByRole("listitem").filter({ hasText: "Aktarım bekliyor" });
  await expect(payoutRow).toContainText("Etkinlik görevlisi");
  await expect(payoutRow).toContainText("Koala Etkinlik");
  await expect(payoutRow).toContainText("Çıkışa alındı");
  await expect(payoutRow).not.toContainText("Tamamlandı");
  await payoutRow.getByText("Hakediş ayrıntısı").click();
  await expect(payoutRow.getByText("Banka hesabı", { exact: true }).locator("xpath=following-sibling::dd[1]")).toHaveText("—");
  await expect(payoutRow).toContainText("sağlayıcısının onayı bekleniyor");

  // 0.9.25 `PayoutDto`: maskeli IBAN, sağlayıcı referansı, çıkış ve mutabakat anları.
  const settledRow = page.getByRole("listitem").filter({ hasText: "Ödendi" });
  await settledRow.getByText("Hakediş ayrıntısı").click();
  await expect(settledRow).toContainText("TR18***2315");
  await expect(settledRow).toContainText("IYZ-7F3A9C");
  await expect(settledRow).toContainText("banka ekstresiyle doğrulandı");
  await expect(settledRow.locator("time[datetime='2026-09-04T09:00:00Z']")).toBeVisible();
  await expect(settledRow.locator("time[datetime='2026-09-05T08:00:00Z']")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("9f1f0d24");
});

test("çalışan kazancını görür, komisyonu görmez; değerlendirme durumu sunucudan okunur", async ({
  page,
  request,
}, testInfo) => {
  // Backend 0.9.25 işçi görünümünde `pricing` ve `totalCharged` null gönderir
  // (is-koala/koala-web#179); kazanç satırı yalnız `workerPayout`, işveren
  // toplamı hiçbir yerde yok.
  await page.goto(`/panel/is/${completedAssignmentId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(page.getByText("Kazanç", { exact: true }).locator("xpath=following-sibling::dd[1]")).toHaveText("₺1.250,00");
  await expect(page.locator("body")).not.toContainText("1.500,00");
  await expect(page.getByRole("heading", { name: "Atamanın fiyat özeti" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Koala hizmet bedeli");

  // Karşı taraf rozeti yalnız varlık; işverenin puanı ekranda değil.
  await expect(page.getByTestId("counterparty-reviewed")).toHaveText("İşveren seni değerlendirdi");

  // Değerlendirme: form → gönderim → sunucunun yeniden okuduğu satır formu kapatır.
  await page.getByText("Değerlendirme bırak").click();
  await page.getByLabel("Puan").selectOption("4");
  await page.getByLabel("Yorum").fill("İyi bir işverendi.");
  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Değerlendirmen kaydedildi." })).toBeVisible();
  await expect(page.getByTestId("assignment-review-summary")).toContainText("Değerlendirmen: ★4 · İyi bir işverendi.");
  await expect(page.getByText("Değerlendirme bırak")).toHaveCount(0);

  const reviews = await request.get(`${backendURL}/__test__/reviews?key=${stateKeyFor(testInfo)}`);
  expect(await reviews.json()).toMatchObject([
    { assignmentId: completedAssignmentId, rating: 4, comment: "İyi bir işverendi.", anonymous: false },
  ]);

  // Yeniden açılan sayfada karar satırdan: özet yükleme anında, form yok.
  await page.reload();
  await expect(page.getByTestId("assignment-review-summary")).toContainText("Değerlendirmen: ★4");
  await expect(page.getByText("Değerlendirme bırak")).toHaveCount(0);
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

test("kabuk menüsü dar ekranda yatay şerit olarak klavyeyle gezilir ve bulunulan bölümü işaretler", async ({
  page,
}) => {
  // Menü <900px'te açılır-kapanır bir `details` değil, yatay kaydırılan bir
  // şerit (#156). JavaScript istemiyor; sekme sırası üst bar → menü → içerik
  // olmalı ve bulunulan bölüm `aria-current` taşımalı.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/panel");

  const menu = page.getByRole("navigation", { name: "Panel menüsü" });
  await expect(menu.getByRole("link", { name: "Genel bakış" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Profilim" })).not.toHaveAttribute("aria-current", /.*/);

  await page.getByRole("link", { name: "Çıkış" }).focus();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Genel bakış" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Profilim" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL("/panel/profil");
  await expect(page.getByRole("heading", { level: 1, name: "Profilim" })).toBeVisible();
  const menuAfter = page.getByRole("navigation", { name: "Panel menüsü" });
  await expect(menuAfter.getByRole("link", { name: "Profilim" })).toHaveAttribute("aria-current", "page");
  await expect(menuAfter.getByRole("link", { name: "Genel bakış" })).not.toHaveAttribute("aria-current", /.*/);
  // Şeridin son maddesi de klavyeyle ulaşılabilir; kaydırma odağı engellemez.
  await menuAfter.getByRole("link", { name: "Hesap ve ayarlar" }).focus();
  await expect(menuAfter.getByRole("link", { name: "Hesap ve ayarlar" })).toBeFocused();
  await expect(menuAfter.getByRole("link", { name: "Hesap ve ayarlar" })).toBeInViewport();
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
