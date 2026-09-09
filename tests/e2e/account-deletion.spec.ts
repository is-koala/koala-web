import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

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

test("sahte backend hesap silme durumlarını test anahtarına göre yalıtır", async ({ request }) => {
  const firstKey = "1111111111111111";
  const secondKey = "2222222222222222";
  const headersFor = (key: string) => ({
    authorization: `Bearer access-${key}`,
    "x-device-id": deviceId,
  });

  for (const key of [firstKey, secondKey]) {
    expect((await request.post(`${backendURL}/__test__/reset?key=${key}`)).ok()).toBe(true);
    expect((await request.post(`${backendURL}/legal/account-deletion`, {
      headers: headersFor(key),
      data: { reason: null },
    })).ok()).toBe(true);
  }

  expect((await request.post(`${backendURL}/__test__/reset?key=${firstKey}`)).ok()).toBe(true);
  expect((await request.get(`${backendURL}/legal/account-deletion`, {
    headers: headersFor(firstKey),
  })).status()).toBe(404);
  expect((await request.get(`${backendURL}/legal/account-deletion`, {
    headers: headersFor(secondKey),
  })).status()).toBe(200);
});

test("oturumlu kullanıcı gerçek formdan silme talebi oluşturur ve REQUESTED durumunu görür", async ({
  page,
  request,
}, testInfo) => {
  const stateKey = stateKeyFor(testInfo);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/panel/hesap");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const deletion = page.getByRole("region", { name: "Hesap silme" });
  await expect(deletion.getByRole("heading", { name: "Hesap silme" })).toBeVisible();
  await deletion.getByLabel("Silme nedeni (isteğe bağlı)").fill("  Hesabımı kapatıyorum  ");
  await deletion.getByRole("checkbox", { name: /geri alınamayacağını anlıyorum/i }).check();
  await deletion.getByRole("button", { name: "Silme talebi oluştur" }).click();

  await expect(deletion.getByRole("status")).toContainText("Talebin alındı");

  const recorded = await (
    await request.get(`${backendURL}/__test__/requests?key=${stateKey}`)
  ).json();
  expect(recorded).toEqual([
    {
      method: "POST",
      path: "/legal/account-deletion",
      body: { reason: "Hesabımı kapatıyorum" },
      authorization: `Bearer ${accessTokenFor(stateKey)}`,
      deviceId,
    },
  ]);

  // Action state'ini değil, backend'den yeniden okunan kalıcı REQUESTED
  // durumunu da doğrula. Bileşen veya GET/POST bağı koparsa bu adım geçemez.
  await page.reload();
  await expect(page.getByRole("region", { name: "Hesap silme" }).getByRole("status"))
    .toContainText("Talebin alındı");
  await expect(page.getByRole("button", { name: "Silme talebi oluştur" })).toHaveCount(0);
});

test("sunucu onay hatası telefon genişliğinde etiketin altında kalır", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/panel/hesap");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  const deletion = page.getByRole("region", { name: "Hesap silme" });
  const confirmation = deletion.getByRole("checkbox", { name: /geri alınamayacağını anlıyorum/i });
  // Yerel HTML kapısını kaldırarak Server Action'ın bağımsız doğrulamasını
  // ve onun çizdiği hata satırını gerçek tarayıcıda sürüyoruz.
  await confirmation.evaluate((element) => element.removeAttribute("required"));
  await deletion.getByRole("button", { name: "Silme talebi oluştur" }).click();

  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  const errorId = await confirmation.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  const error = page.locator(`#${errorId}`);
  await expect(error).toContainText("Geri alınamaz etkiyi onaylamalısın.");

  const labelBox = await deletion.locator(`label[for="confirmation-account-deletion-irrevocable"]`).boundingBox();
  const errorBox = await error.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(errorBox).not.toBeNull();
  expect(errorBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height - 1);
  expect(errorBox!.x).toBeGreaterThanOrEqual(labelBox!.x - 1);

  await page.screenshot({ path: testInfo.outputPath("checkbox-error-375px.png"), fullPage: true });
});

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}

function accessTokenFor(stateKey: string) {
  return `access-${stateKey}`;
}
