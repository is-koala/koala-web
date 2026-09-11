import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/**
 * İlan galerisi dumanı.
 *
 * Yükleme BFF üzerinden gider (ADR-0011); Playwright API'yi görmez, sahte
 * backend `tests/support/e2e-backend.mjs` oturum anahtarına göre galeriyi
 * tutar. Sıra ve kapak yenilemeden sonra da aynı kalmalı — aksi hâlde PUT
 * tam liste göndermiyordur.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const galleryPath = `/isveren/ilan/${jobId}/galeri`;

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

test("oturumsuz kullanıcı galeri adresinden girişe düşer", async ({ request }) => {
  const targets = [
    [galleryPath, `/giris?next=${encodeURIComponent(galleryPath)}`],
    [
      `/isveren/sirket/${companyId}/galeri`,
      `/giris?next=${encodeURIComponent(`/isveren/sirket/${companyId}/galeri`)}`,
    ],
  ];

  for (const [path, destination] of targets) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toBe(destination);
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
  }
});

test("ilan galerisine yüklenen görsel listede kalır, kapak ve sıra yenilemede korunur", async ({
  page,
}) => {
  await page.goto(galleryPath);
  const consent = page.getByRole("button", { name: "Yalnız zorunlu" });
  if (await consent.isVisible()) await consent.click();

  await expect(page.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Henüz görsel yok");

  await page.locator("#gallery-files").setInputFiles([
    { name: "mutfak.webp", mimeType: "image/webp", buffer: Buffer.from("mutfak") },
    { name: "salon.webp", mimeType: "image/webp", buffer: Buffer.from("salon") },
  ]);

  const items = page.locator(".gallery-editor-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0).getByRole("radio", { name: "Kapak" })).toBeChecked();
  await expect(items.nth(0).locator("img")).toHaveAttribute(
    "src",
    "https://cdn.example.test/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.webp",
  );

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(galleryPath) && response.request().method() === "POST",
    ),
    items.nth(1).getByRole("radio", { name: "Kapak" }).click(),
  ]);
  await expect(items.nth(1).getByRole("radio", { name: "Kapak" })).toBeChecked();
  await expect(items.nth(0).getByRole("radio", { name: "Kapak" })).not.toBeChecked();

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(galleryPath) && response.request().method() === "POST",
    ),
    items.nth(0).dragTo(items.nth(1)),
  ]);
  await expect(items.nth(0).locator("img")).toHaveAttribute(
    "src",
    "https://cdn.example.test/aaaaaaaa-aaaa-4aaa-8aaa-000000000002.webp",
  );
  await expect(items.nth(0).getByRole("radio", { name: "Kapak" })).toBeChecked();

  await page.reload();

  const reloaded = page.locator(".gallery-editor-item");
  await expect(reloaded).toHaveCount(2);
  await expect(reloaded.nth(0).locator("img")).toHaveAttribute(
    "src",
    "https://cdn.example.test/aaaaaaaa-aaaa-4aaa-8aaa-000000000002.webp",
  );
  await expect(reloaded.nth(1).locator("img")).toHaveAttribute(
    "src",
    "https://cdn.example.test/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.webp",
  );
  await expect(reloaded.nth(0).getByRole("radio", { name: "Kapak" })).toBeChecked();
  await expect(reloaded.nth(1).getByRole("radio", { name: "Kapak" })).not.toBeChecked();
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
