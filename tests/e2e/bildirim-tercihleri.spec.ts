import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const unsubscribeEndpoint = "/api/notification-preferences/unsubscribe";

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
  const apiRequests: { referer: string | null; body: string | null }[] = [];
  page.on("request", async (sent) => {
    if (new URL(sent.url()).pathname === unsubscribeEndpoint) {
      apiRequests.push({ referer: await sent.headerValue("referer"), body: sent.postData() });
    }
  });

  const response = await openUnsubscribeLink(page, token);

  // E-posta tarayıcıları bağlantıyı GET ile açıyor: açılış backend'e gitmez.
  expect(response?.status()).toBe(200);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: "Abonelikten çık" })).toBeEnabled();
  expect(await backendRequestsFor(request, token)).toBe(0);
  expect(apiRequests).toEqual([]);
  // Token yalnız adres çubuğunda; ekrandaki hiçbir alana yazılmıyor.
  expect(await page.locator("main").innerHTML()).not.toContain(token);

  await page.getByRole("button", { name: "Abonelikten çık" }).click();

  // Next'in rota duyurucusu da `role="alert"` taşıyor; iddialar içerikle sınırlı.
  const done = page.getByRole("main").getByRole("status");
  await expect(done).toContainText("Abonelikten çıktın");
  await expect(done).toContainText("Kampanya ve duyurular");
  await expect(done).toContainText("E-posta");
  await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
  expect(await backendRequestsFor(request, token)).toBe(1);
  // Token gövdede gidiyor, Referer ile değil.
  expect(apiRequests).toEqual([{ referer: null, body: JSON.stringify({ token }) }]);

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
  await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
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
