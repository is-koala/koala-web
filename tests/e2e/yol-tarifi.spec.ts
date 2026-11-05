import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";
const completedAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f63";

/**
 * Çalışan iş ayrıntısında toplu taşımayla yol tarifi (is-koala/koala-web#178).
 * Bağlantı yalnız kesin adresli (ADR-0003) etkin atamada; koordinat yalnız
 * hedef olarak URL'de, kullanıcının konumu yok.
 */
function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}

async function signIn(
  context: import("@playwright/test").BrowserContext,
  request: import("@playwright/test").APIRequestContext,
  testInfo: TestInfo,
  query: string,
) {
  const stateKey = stateKeyFor(testInfo);
  expect((await request.post(`${backendURL}/__test__/reset?key=${stateKey}${query}`)).ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
}

test("kesin adresli onaylı işte iki haritaya toplu taşıma tarifi verir", async ({
  context,
  page,
  request,
}, testInfo) => {
  await signIn(context, request, testInfo, "&address=exact");

  await page.goto(`/panel/is/${paidAssignmentId}`);

  const route = page.getByRole("region", { name: "Toplu taşımayla yol tarifi" });
  await expect(route).toBeVisible();
  await expect(route.getByRole("link", { name: "Google Haritalar'da aç" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=40.987654%2C29.025431&travelmode=transit",
  );
  await expect(route.getByRole("link", { name: "Apple Haritalar'da aç" })).toHaveAttribute(
    "href",
    "https://maps.apple.com/?daddr=40.987654%2C29.025431&dirflg=r",
  );
  await expect(route.getByRole("link", { name: "Google Haritalar'da aç" })).toHaveAttribute(
    "target",
    "_blank",
  );
});

test("biten işte kesin adres gelse de yol tarifi yok", async ({ context, page, request }, testInfo) => {
  await signIn(context, request, testInfo, "&address=exact");

  await page.goto(`/panel/is/${completedAssignmentId}`);

  await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(page.getByRole("region", { name: /yol tarifi/ })).toHaveCount(0);
});

test("yaklaşık adreste yol tarifi yok", async ({ context, page, request }, testInfo) => {
  await signIn(context, request, testInfo, "");

  await page.goto(`/panel/is/${paidAssignmentId}`);

  await expect(page.getByRole("heading", { level: 1, name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(page.getByText("Adres işin güncel durumunda paylaşılmıyor.")).toBeVisible();
  await expect(page.getByRole("region", { name: /yol tarifi/ })).toHaveCount(0);
});
