import { createHash } from "node:crypto";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

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

test("boş Maps anahtarında betik inmez ve konum klavyeyle onaylanır", async ({ page }) => {
  const mapsScripts: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("maps.googleapis.com")) mapsScripts.push(request.url());
  });

  await page.goto("/panel/adres");
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();

  await expect(page.getByRole("heading", { name: "Adresin" })).toBeVisible();
  await expect(page.getByText("Harita şu anda kullanılamıyor")).toBeVisible();
  expect(mapsScripts).toEqual([]);

  await fillWithKeyboard(page, page.getByLabel("Enlem"), "41.05");
  await fillWithKeyboard(page, page.getByLabel("Boylam"), "29.01");
  await tabTo(page, page.getByRole("button", { name: "Konumu onayla" }));
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("Enlem")).toHaveValue("41.05");
  await expect(page.getByRole("button", { name: "Adresi kaydet" })).toBeVisible();
});

async function fillWithKeyboard(page: Page, field: Locator, value: string) {
  await tabTo(page, field);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(value);
}

async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 80; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Beklenen denetim 40 klavye durağında bulunamadı.");
}

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}

function accessTokenFor(stateKey: string) {
  return `access-${stateKey}`;
}
