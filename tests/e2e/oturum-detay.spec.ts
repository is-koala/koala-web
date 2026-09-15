import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/*
 * Oturum ayrıntısı (is-koala/koala-web#188): hesap sayfasındaki satırdan
 * ayrıntıya, cihazı adlandırma, oturumu kapatma; eski sunucuda satırın
 * bağlantısız kalması ve bilinmeyen oturumun gerçek 404 alması.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const otherSessionId = "0e30edb1-3642-458b-aa0b-7569842448f0";
const otherDeviceUuid = "5a7c1a3e-9d0e-4c8b-8f1a-2b3c4d5e6f70";
const unknownSessionId = "11111111-2222-4333-8444-555555555555";

async function signedIn(
  { context, request }: { context: import("@playwright/test").BrowserContext; request: import("@playwright/test").APIRequestContext },
  testInfo: TestInfo,
  mode: "detail" | "legacy",
) {
  const stateKey = stateKeyFor(testInfo);
  const reset = await request.post(`${backendURL}/__test__/reset?key=${stateKey}&sessions=${mode}`);
  expect(reset.ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
  return stateKey;
}

test("satırdan ayrıntıya gider, cihazı adlandırır ve yeni ad listeye döner", async ({
  page,
  context,
  request,
}, testInfo) => {
  const stateKey = await signedIn({ context, request }, testInfo, "detail");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/panel/hesap");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const sessions = page.getByRole("region", { name: "Oturumlar ve cihazlar" });
  await sessions.getByRole("link", { name: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0" }).click();

  // Dinamik rota ilk gezinmede `next dev` altında derleniyor; yük altında 5 sn yetmiyor.
  await expect(page).toHaveURL(`/panel/oturum/${otherSessionId}`, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0" }),
  ).toBeVisible();
  const facts = page.getByRole("region", { name: "Oturum bilgileri" });
  await expect(facts).toContainText("IP adresi—");
  await expect(facts).toContainText("Konum—");
  await expect(facts).toContainText("Toplam giriş0");
  await expect(page.getByText("Geçmiş, güncellemeden sonraki girişleri kapsar.")).toBeVisible();
  await expect(page.getByText("Bu cihaz", { exact: true })).toHaveCount(0);

  const nameField = page.getByRole("textbox", { name: "Cihaz adı" });
  await nameField.fill("  Evdeki iPad  ");
  await page.getByRole("button", { name: "Cihazı adlandır" }).click();
  await expect(page.getByRole("status")).toContainText("Cihaz adı güncellendi.");

  const renames = await (await request.get(`${backendURL}/__test__/device-renames?key=${stateKey}`)).json();
  expect(renames).toEqual([{ deviceId: otherDeviceUuid, name: "Evdeki iPad" }]);

  // Sayfa yenilenince yeni ad hem başlıkta hem hesap listesinde okunmalı.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Evdeki iPad" })).toBeVisible();
  await expect(nameField).toHaveValue("Evdeki iPad");
  await page.getByRole("link", { name: "← Oturumlar ve cihazlar" }).click();
  await expect(page).toHaveURL(/\/panel\/hesap#oturumlar$/, { timeout: 15_000 });
  await expect(
    page.getByRole("region", { name: "Oturumlar ve cihazlar" }).getByRole("link", { name: "Evdeki iPad" }),
  ).toBeVisible();
});

test("boş adı action ön denetimi backend'e gitmeden alanın altında reddeder", async ({
  page,
  context,
  request,
}, testInfo) => {
  const stateKey = await signedIn({ context, request }, testInfo, "detail");
  await page.goto(`/panel/oturum/${otherSessionId}`);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const nameField = page.getByRole("textbox", { name: "Cihaz adı" });
  // Yerel HTML kapısını kaldırıp Server Action'ın kendi doğrulamasını sürüyoruz.
  await nameField.evaluate((element) => element.removeAttribute("required"));
  await nameField.fill("   ");
  await page.getByRole("button", { name: "Cihazı adlandır" }).click();

  await expect(nameField).toHaveAttribute("aria-invalid", "true");
  const errorId = await nameField.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`#${errorId!.split(" ").pop()}`)).toContainText("Cihaza bir ad ver.");
  expect(await (await request.get(`${backendURL}/__test__/device-renames?key=${stateKey}`)).json()).toEqual([]);
});

test("backend'in 400 reddi alanın altında görünür ve yazılan ad alanda kalır", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signedIn({ context, request }, testInfo, "detail");
  await page.goto(`/panel/oturum/${otherSessionId}`);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const nameField = page.getByRole("textbox", { name: "Cihaz adı" });
  await nameField.fill("__backend_reject__");
  await page.getByRole("button", { name: "Cihazı adlandır" }).click();

  await expect(nameField).toHaveAttribute("aria-invalid", "true");
  const errorId = await nameField.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`#${errorId!.split(" ").pop()}`)).toContainText("Cihaz adı kabul edilmedi.");
  // React 19 `<form action>` hata dönüşünde alanı sıfırlıyordu; yazılan ad durmalı.
  await expect(nameField).toHaveValue("__backend_reject__");
});

test("mevcut cihazı rozetler, kapatmayı çıkışa bağlar, geçmişi rozetlerle listeler", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signedIn({ context, request }, testInfo, "detail");
  await page.goto("/panel/hesap");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  await page
    .getByRole("region", { name: "Oturumlar ve cihazlar" })
    .getByRole("link", { name: "iOS 18 · Koala 0.1.0 · web" })
    .click();

  await expect(page.getByRole("heading", { name: /iOS 18 · Koala 0\.1\.0 · web/ })).toContainText(
    "Bu cihaz",
  );
  const facts = page.getByRole("region", { name: "Oturum bilgileri" });
  await expect(facts).toContainText("IP adresi192.0.2.1");
  await expect(facts).toContainText("KonumYaklaşık: İstanbul, TR");
  await expect(facts).toContainText("Toplam giriş3");
  const history = page.getByRole("list", { name: "Giriş denemeleri" }).getByRole("listitem");
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText("Başarılı");
  await expect(history.nth(1)).toContainText("Başarısız");
  await expect(page.getByRole("button", { name: "Oturumu kapat" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bu cihazdan çıkış yap" })).toHaveAttribute("href", "/cikis");
});

test("diğer cihazın oturumunu kapatır ve listeye döner; kapatılan oturum 404 olur", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signedIn({ context, request }, testInfo, "detail");
  await page.goto(`/isveren/oturum/${otherSessionId}`);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  await page.getByRole("button", { name: "Oturumu kapat" }).click();

  await expect(page).toHaveURL(/\/isveren\/hesap(#oturumlar)?$/, { timeout: 15_000 });
  const sessions = page.getByRole("region", { name: "Oturumlar ve cihazlar" });
  await expect(sessions.getByRole("link", { name: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0" })).toHaveCount(0);
  await expect(sessions.getByRole("link", { name: "iOS 18 · Koala 0.1.0 · web" })).toBeVisible();

  const revoked = await page.request.get(`${baseURL}/isveren/oturum/${otherSessionId}`);
  expect(revoked.status()).toBe(404);
});

test("bilinmeyen ve biçimsiz oturum kimliği gerçek 404 alır", async ({ page, context, request }, testInfo) => {
  await signedIn({ context, request }, testInfo, "detail");

  expect((await page.request.get(`${baseURL}/panel/oturum/${unknownSessionId}`)).status()).toBe(404);
  expect((await page.request.get(`${baseURL}/panel/oturum/not-a-uuid`)).status()).toBe(404);
});

test("eski sunucuda liste çalışır ama satır bağlantısız kalır", async ({ page, context, request }, testInfo) => {
  await signedIn({ context, request }, testInfo, "legacy");
  await page.goto("/panel/hesap");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const sessions = page.getByRole("region", { name: "Oturumlar ve cihazlar" });
  await expect(sessions.getByText("iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0", { exact: true })).toBeVisible();
  await expect(sessions.getByText("iOS 18 · Koala 0.1.0 · web", { exact: true })).toBeVisible();
  await expect(sessions.getByRole("link", { name: /iPhone 14 Pro Max|iOS 18 · Koala/ })).toHaveCount(0);
  await expect(sessions.getByRole("button", { name: /oturumunu kapat$/ })).toBeVisible();
  // Uyarı, toast ya da açıklama yok: liste eski sunucuda da sessizce çalışır.
  // (Next dev araçlarının kendi boş `alert`i sayfada duruyor; bölge içine bakılır.)
  await expect(sessions.getByRole("alert")).toHaveCount(0);
  await expect(sessions.getByRole("status")).toHaveCount(0);

  // Adres elle yazılsa da eski sunucuda ayrıntı yok: gerçek 404.
  expect((await page.request.get(`${baseURL}/panel/oturum/${otherSessionId}`)).status()).toBe(404);
});

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}
