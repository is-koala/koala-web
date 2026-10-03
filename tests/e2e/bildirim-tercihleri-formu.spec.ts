import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

/**
 * Bildirim tercihleri formu (is-koala/koala-web#198).
 *
 * Backend mesaj/ulaşım kategorilerini ve SMS kanalını döndürüyor; web
 * listesi geride kaldığında form bilmediği satırları gönderiyor ve **her**
 * kayıt "Güncellenecek iletişim tercihi bulunamadı." ile düşüyordu. Fikstür
 * ayrıca web'in henüz tanımadığı bir kategori döndürüyor: o satır formda
 * görünmemeli ve kaydı bozmamalı.
 */
function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}

test.beforeEach(async ({ context, request }, testInfo) => {
  const stateKey = stateKeyFor(testInfo);
  expect((await request.post(`${backendURL}/__test__/reset?key=${stateKey}`)).ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
});

for (const shellPath of ["/panel/hesap", "/isveren/hesap"]) {
  test(`${shellPath} tercih formu mesaj, ulaşım ve SMS satırlarıyla kaydeder`, async ({
    page,
    request,
  }, testInfo) => {
    await page.goto(shellPath);
    const consent = page.getByRole("button", { name: "Yalnız zorunlu" });
    if (await consent.isVisible()) await consent.click();

    const section = page.getByRole("region", { name: "Bildirim tercihleri" });
    await expect(section.getByRole("checkbox", { name: /SMS · Mesajlar/ })).toBeChecked();
    await expect(section.getByRole("checkbox", { name: /Anlık bildirim · Ulaşım/ })).toBeDisabled();
    await expect(section).not.toContainText("undefined");
    await expect(section).not.toContainText("FUTURE_CATEGORY");

    await section.getByRole("checkbox", { name: /SMS · Mesajlar/ }).uncheck();
    await section.getByRole("checkbox", { name: /SMS · İş alarmları/ }).check();
    await section.getByRole("button", { name: "İletişim tercihlerini kaydet" }).click();

    await expect(section.getByRole("status")).toContainText("İletişim tercihlerin güncellendi");

    const sent = (await (
      await request.get(
        `${backendURL}/__test__/notification-preference-requests?key=${stateKeyFor(testInfo)}`,
      )
    ).json()) as { category: string; channel: string; enabled: boolean }[][];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual(
      expect.arrayContaining([
        { category: "MESSAGES", channel: "SMS", enabled: false },
        { category: "JOB_ALERTS", channel: "SMS", enabled: true },
      ]),
    );
    // İşlemsel satır ve tanınmayan satır gönderilmez.
    expect(sent[0].some((entry) => entry.category === "TRANSPORT")).toBe(false);
    expect(sent[0].some((entry) => entry.category === "FUTURE_CATEGORY")).toBe(false);
  });
}
