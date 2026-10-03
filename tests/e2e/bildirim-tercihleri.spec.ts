import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page, type Request } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const unsubscribeEndpoint = "/api/notification-preferences/unsubscribe";
const manageLabel = "Bildirim tercihlerimi yönet";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

/** Uç oturumsuz; sahte backend durumu tokenın kendisine bağlıyor, testler ayrışsın diye benzersiz. */
function tokenWith(prefix: string) {
  return `${prefix}${randomBytes(12).toString("base64url")}`;
}

async function backendRequestsFor(
  request: import("@playwright/test").APIRequestContext,
  token: string,
): Promise<number> {
  const response = await request.get(
    `${backendURL}/__test__/unsubscribe-requests?token=${encodeURIComponent(token)}`,
  );
  return ((await response.json()) as { count: number }).count;
}

async function openUnsubscribeLink(page: Page, token: string) {
  const response = await page.goto(`/bildirim-tercihleri/cikis?token=${token}`);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  return response;
}

test("çıkış bağlantısı açılışta hiçbir şeyi değiştirmez, onayla kapatır ve ikinci tıkı hata saymaz", async ({
  page,
  request,
}) => {
  const token = tokenWith("abone-");
  // İstek nesnesi eşzamanlı toplanıyor; başlıklar iddiadan hemen önce
  // okunuyor ki asenkron bir dinleyici iddiayla yarışmasın.
  const apiRequests: Request[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).pathname === unsubscribeEndpoint) apiRequests.push(sent);
  });

  const response = await openUnsubscribeLink(page, token);

  // E-posta tarayıcıları bağlantıyı GET ile açıyor: açılış backend'e gitmez.
  expect(response?.status()).toBe(200);
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: "Abonelikten çık" })).toBeEnabled();
  expect(await backendRequestsFor(request, token)).toBe(0);
  expect(apiRequests).toEqual([]);
  // Token yalnız adres çubuğunda; ekrandaki hiçbir alana yazılmıyor.
  expect(await page.locator("main").innerHTML()).not.toContain(token);

  const [sent] = await Promise.all([
    page.waitForRequest((candidate) => new URL(candidate.url()).pathname === unsubscribeEndpoint),
    page.getByRole("button", { name: "Abonelikten çık" }).click(),
  ]);

  // Next'in rota duyurucusu da `role="alert"` taşıyor; iddialar içerikle sınırlı.
  const done = page.getByRole("main").getByRole("status");
  await expect(done).toContainText("Abonelikten çıktın");
  await expect(done).toContainText("Kampanya ve duyurular");
  await expect(done).toContainText("E-posta");
  // Form kayboluyor; odak sonucun başlığına geçer, `<body>`'ye düşmez.
  await expect(page.getByRole("heading", { name: "Abonelikten çıktın" })).toBeFocused();
  await expect(page.getByRole("link", { name: manageLabel })).toHaveAttribute(
    "href",
    "/hesap/bildirimler",
  );
  expect(await backendRequestsFor(request, token)).toBe(1);
  // Token gövdede gidiyor, Referer ile değil.
  expect(apiRequests).toEqual([sent]);
  expect(await sent.headerValue("referer")).toBeNull();
  expect(sent.postData()).toBe(JSON.stringify({ token }));

  // Token tek kullanımlık değil, süreli: aynı bağlantıya ikinci tık hata değil.
  await page.reload();
  await page.getByRole("button", { name: "Abonelikten çık" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Bu bildirimler zaten kapalı");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(await backendRequestsFor(request, token)).toBe(2);
});

test("süresi dolmuş ve geçersiz bağlantı ayrı ayrı anlatılır", async ({ page }) => {
  await openUnsubscribeLink(page, tokenWith("suresi-dolmus-"));
  await page.getByRole("button", { name: "Abonelikten çık" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantının süresi dolmuş");
  await expect(page.getByRole("button", { name: "Abonelikten çık" })).toHaveCount(0);

  await page.goto(`/bildirim-tercihleri/cikis?token=${tokenWith("tanimsiz-")}`);
  await page.getByRole("button", { name: "Abonelikten çık" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı geçersiz");
  await expect(page.getByRole("link", { name: manageLabel })).toBeVisible();
});

test("tokensız ya da tekrarlanan tokenlı bağlantı backend'e sorulmadan geçersiz sayılır", async ({
  page,
}) => {
  let apiCalls = 0;
  page.on("request", (sent) => {
    if (new URL(sent.url()).pathname === unsubscribeEndpoint) apiCalls += 1;
  });

  for (const path of ["/bildirim-tercihleri/cikis", "/bildirim-tercihleri/cikis?token=bir&token=iki"]) {
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bağlantı geçersiz");
    await expect(page.getByRole("button", { name: "Abonelikten çık" })).toHaveCount(0);
  }
  expect(apiCalls).toBe(0);
});

test("geçici arıza herkese açık katalogla anlatılır ve onay yeniden denenebilir", async ({ page }) => {
  await openUnsubscribeLink(page, tokenWith("ariza-"));
  await page.getByRole("button", { name: "Abonelikten çık" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText("Bir sorun oluştu");
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abonelikten çık" })).toBeEnabled();
});

test("JavaScript kapalıyken onay düğmesi kapalı ve not görünür", async ({ browser }) => {
  // Sayfa statik; token yalnız istemcide okunuyor. Hidrasyon olmadan düğmenin
  // eylemi React'in yer tutucusu, yani basılabilir görünmesi dokunuşu yutardı.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`/bildirim-tercihleri/cikis?token=${tokenWith("abone-")}`);

  await expect(page.getByRole("button", { name: "Abonelikten çık" })).toBeDisabled();
  // Playwright'ın metin eşleyicisi `<noscript>` içeriğini atlıyor; notun
  // belgede olduğu serileştirilmiş DOM'dan doğrulanıyor.
  expect(await page.content()).toMatch(
    /<noscript>[\s\S]*Bu işlem için tarayıcında JavaScript açık olmalı\.[\s\S]*<\/noscript>/,
  );
  await context.close();
});

test("tercih yönetimi adresi oturumsuz ziyaretçiyi buraya dönecek biçimde girişe gönderir", async ({
  page,
}) => {
  await page.goto("/hesap/bildirimler");

  await expect(page).toHaveURL(/\/giris\?next=%2Fhesap%2Fbildirimler$/);
  await expect(page.locator("input[name='next']")).toHaveValue("/hesap/bildirimler");
});

test("tercih yönetimi adresi oturumlu çalışanı kendi tercihlerine bırakır", async ({
  context,
  page,
  request,
}, testInfo) => {
  const stateKey = createHash("sha256").update(testInfo.testId).digest("hex").slice(0, 16);
  expect((await request.post(`${backendURL}/__test__/reset?key=${stateKey}`)).ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);

  await page.goto("/hesap/bildirimler");

  await expect(page).toHaveURL(/\/panel\/hesap#bildirim-tercihleri$/);
  await expect(page.getByRole("heading", { name: "Bildirim tercihleri" })).toBeVisible();
});
