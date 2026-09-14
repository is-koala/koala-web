import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/**
 * Şirket adresi düzenleme (is-koala/koala-web#172).
 *
 * Yazma BFF üzerinden `PATCH /companies/{id}` `{ address }` ile gider
 * (ADR-0011); sahte backend `tests/support/e2e-backend.mjs` üyeliği
 * `?companyRole=` ile verir ve adresi test anahtarının durumunda tutar.
 * Harita anahtarı e2e'de boş: konum enlem/boylamla onaylanır.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profilePath = `/isveren/sirket/${companyId}`;
const addressPath = `${profilePath}/adres`;
const kadikoyDistrictId = "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53";
const currentAddress = "Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul";
const newAddress = "Moda Caddesi No: 5, Caferağa, Kadıköy/İstanbul";

async function signIn(
  { context, request }: { context: import("@playwright/test").BrowserContext; request: import("@playwright/test").APIRequestContext },
  testInfo: TestInfo,
  role: "ADMIN" | "CONTACT",
) {
  const stateKey = stateKeyFor(testInfo);
  const reset = await request.post(`${backendURL}/__test__/reset?key=${stateKey}&companyRole=${role}`);
  expect(reset.ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
  return stateKey;
}

test("yönetici şirket adresini kaydeder ve profil yeni adresi gösterir", async ({
  page,
  context,
  request,
}, testInfo) => {
  const stateKey = await signIn({ context, request }, testInfo, "ADMIN");

  await page.goto(profilePath);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  const addressSection = page.getByRole("region", { name: "Şirket adresi" });
  await expect(addressSection).toContainText(currentAddress);
  await addressSection.getByRole("link", { name: "Düzenle" }).click();

  await expect(page).toHaveURL(new RegExp(`${addressPath}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Şirket adresini düzenle" })).toBeVisible();
  await expect(page.getByText(currentAddress)).toBeVisible();

  // Sağlayıcı sahte backend'de yok; idari bölüm elle seçilir.
  await page.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }).click();
  await page.getByLabel("Ülke").selectOption({ label: "Türkiye" });
  await page.getByLabel("İl", { exact: true }).selectOption({ label: "İstanbul" });
  await page.getByLabel("İlçe").selectOption({ label: "Kadıköy" });

  await page.getByLabel("Mahalle").fill("Caferağa");
  await page.getByLabel("Cadde veya sokak").fill("Moda Caddesi");
  await page.getByLabel("Bina numarası").fill("5");
  await page.getByLabel("Posta kodu").fill("34710");

  await expect(page.getByText("Harita şu anda kullanılamıyor")).toBeVisible();
  await page.getByLabel("Enlem").fill("40.98");
  await page.getByLabel("Boylam").fill("29.03");
  await page.getByRole("button", { name: "Konumu onayla" }).click();

  await page.getByRole("button", { name: "Adresi kaydet" }).click();

  const done = page.getByRole("status").filter({ hasText: "Şirket adresi kaydedildi" });
  await expect(done).toBeVisible();
  await expect(done).toContainText(newAddress);

  // Gövde yalnız adres taşır: metin alanlarını boş dizeyle göndermek şirket
  // adını silerdi. Pin elle onaylandığı için aday kanıtı da gitmez.
  const requests = await (
    await request.get(`${backendURL}/__test__/company-requests?key=${stateKey}`)
  ).json();
  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe("PATCH");
  expect(Object.keys(requests[0].body)).toEqual(["address"]);
  expect(requests[0].body.address).toMatchObject({
    districtId: kadikoyDistrictId,
    components: { neighborhood: "Caferağa", thoroughfare: "Moda Caddesi", buildingNumber: "5", postalCode: "34710" },
    position: { latitude: 40.98, longitude: 29.03, source: "USER_CONFIRMED_PIN" },
  });
  expect(requests[0].body.address).not.toHaveProperty("candidateToken");

  await done.getByRole("link", { name: "Yeni adresi profilde gör" }).click();
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`));
  await expect(page.getByRole("region", { name: "Şirket adresi" })).toContainText(newAddress);
  await expect(page.getByText(currentAddress)).toHaveCount(0);
});

test("ödeme kapısının çapalı bağlantısı tek şirketli yöneticiyi profildeki adres bölümüne bırakır", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signIn({ context, request }, testInfo, "ADMIN");

  // Tam yükleme: 307 hedefi çapayı taşır; bölüm `Suspense` arkasından
  // geldiği için kaydırmayı `AnchorReveal` yapar.
  await page.goto("/isveren/sirket?bolum=sirket-adresi");
  await expect(page).toHaveURL(new RegExp(`${profilePath}#sirket-adresi$`));
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  await expect(page.locator("#sirket-adresi")).toBeInViewport();

  // İstemci gezinmesi: kapı bağlantısı `next/link`, yönlendirme App Router'ın
  // içinde çözülüyor. Parça (`#`) bu yolda düşüyor (ölçüldü), sorgu düşmüyor.
  await page.goto("/isveren");
  // Hidrasyon bitmeden verilen `push` düşüyor; kabuk menüsü çizilince hazır.
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { next?: { router?: unknown } }).next?.router));
  await page.evaluate(() =>
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
      "/isveren/sirket?bolum=sirket-adresi",
    ),
  );
  await expect(page).toHaveURL(new RegExp(`${profilePath}#sirket-adresi$`), { timeout: 15_000 });
  await expect(page.locator("#sirket-adresi")).toBeInViewport();
});

test("yetkili adresi salt okur; düzenleme adresi 404 döner", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signIn({ context, request }, testInfo, "CONTACT");

  await page.goto(profilePath);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  const addressSection = page.getByRole("region", { name: "Şirket adresi" });
  await expect(addressSection).toContainText(currentAddress);
  await expect(addressSection.getByRole("link", { name: "Düzenle" })).toHaveCount(0);

  // Üye olmayanla aynı cevap: backend `requireCompanyAdmin` geçemeyene 404
  // dönüyor ve web bu ayrımı açmıyor.
  const response = await page.goto(addressPath);
  expect(response?.status()).toBe(404);
});

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}
