import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/**
 * Mesajlaşmanın ödeme kapısı (is-koala/koala-web#157).
 *
 * Sahte backend (`tests/support/e2e-backend.mjs`) aynı ilan için iki atama
 * veriyor: ödemesi bekleyen biri `messagingAvailable: false` /
 * `PAYMENT_REQUIRED`, emanete alınmış öbürü `true` / `AVAILABLE`. Kapı
 * satırdan okunur; web onu ödeme durumundan yeniden türetmez. Bu yüzden ölçü
 * iki sayfada da aynı: düğme yalnız ikinci atamada, ödeme yolu yalnız
 * işverenin ilkinde.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const unpaidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";

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

test("işveren ödeme öncesi mesaj düğmesi görmez, ödeme yolunu görür", async ({ page }) => {
  await page.goto(`/isveren/atama/${unpaidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();

  const messaging = page.getByRole("region", { name: "Mesajlaşma" });
  await expect(messaging).toBeVisible();
  await expect(messaging.getByRole("button", { name: "Mesaj gönder" })).toHaveCount(0);
  await expect(messaging.getByRole("status")).toContainText(
    "Mesajlaşma, işveren ödemeyi tamamladığında açılır.",
  );
  await expect(messaging.getByRole("link", { name: "Ödemeyi tamamla" })).toHaveAttribute(
    "href",
    `/isveren/atama/${unpaidAssignmentId}/odeme`,
  );
});

test("işveren ödeme emanete düşünce mesaj düğmesini görür", async ({ page }) => {
  await page.goto(`/isveren/atama/${paidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();

  const messaging = page.getByRole("region", { name: "Mesajlaşma" });
  await expect(messaging.getByRole("button", { name: "Mesaj gönder" })).toBeVisible();
  await expect(messaging.getByRole("link", { name: "Ödemeyi tamamla" })).toHaveCount(0);
  await expect(messaging.getByRole("status")).toHaveCount(0);
});

test("çalışan ödeme öncesi açıklama görür, ödeme yolu görmez; ödeme sonrası düğme açılır", async ({
  page,
}) => {
  await page.goto(`/panel/is/${unpaidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();

  const before = page.getByRole("region", { name: "Mesajlaşma" });
  await expect(before.getByRole("button", { name: "Mesaj gönder" })).toHaveCount(0);
  await expect(before.getByRole("status")).toContainText(
    "Mesajlaşma, işveren ödemeyi tamamladığında açılır.",
  );
  await expect(page.getByRole("link", { name: "Ödemeyi tamamla" })).toHaveCount(0);

  await page.goto(`/panel/is/${paidAssignmentId}`);
  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Mesajlaşma" }).getByRole("button", { name: "Mesaj gönder" }),
  ).toBeVisible();
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
