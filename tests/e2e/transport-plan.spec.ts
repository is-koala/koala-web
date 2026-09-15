import { createHash } from "node:crypto";

import { expect, test, type TestInfo } from "@playwright/test";

/**
 * Ulaşım planı T1 (is-koala/koala-web#187, backend 0.9.28).
 *
 * Sahte backend (`tests/support/e2e-backend.mjs`) planı test anahtarının
 * durumunda tutuyor: `?transport=plan` gidiş servisi + dönüş yol parası
 * fikstürünü açar, `?transport=race` koltuk seçimini 409 ile reddeder.
 * Harita anahtarı e2e'de boş: durak konumu enlem/boylamla onaylanır.
 */

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const backendPort = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? webPort + 1_000);
const backendURL = `http://127.0.0.1:${backendPort}`;
const baseURL = `http://localhost:${webPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";
const unpaidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61";
const shuttleId = "cccccccc-cccc-4ccc-8ccc-000000000001";
const bostanciStopId = "cccccccc-cccc-4ccc-8ccc-000000000012";
const kadikoyDistrictId = "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53";

async function signIn(
  { context, request }: { context: import("@playwright/test").BrowserContext; request: import("@playwright/test").APIRequestContext },
  testInfo: TestInfo,
  transport: "none" | "plan" | "race",
) {
  const stateKey = stateKeyFor(testInfo);
  const reset = await request.post(`${backendURL}/__test__/reset?key=${stateKey}&transport=${transport}`);
  expect(reset.ok()).toBe(true);
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: baseURL },
    { name: "koala_rt", value: "refresh-placeholder", url: baseURL },
    { name: "koala_did", value: deviceId, url: baseURL },
  ]);
  return stateKey;
}

test("işveren ilan sayfasından servisli planı yazar; ikinci kayıt kimlikle yerinde günceller", async ({
  page,
  context,
  request,
}, testInfo) => {
  const stateKey = await signIn({ context, request }, testInfo, "none");

  await page.goto(`/isveren/ilan/${openJobId}`);
  const editor = page.getByRole("region", { name: "Ulaşım planı" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("İşe gidiş").selectOption("SHUTTLE");
  await editor.getByLabel("İşten dönüş").selectOption("CASH_ALLOWANCE");
  await editor.getByLabel("Yol parası (₺)").fill("150");
  await editor.getByRole("button", { name: "Servis ekle" }).click();

  const shuttle = editor.getByTestId("transport-shuttle");
  await shuttle.getByLabel("Servis adı").fill("Anadolu yakası servisi");
  await shuttle.getByLabel("Koltuk sayısı").fill("12");
  await shuttle.getByLabel("Plaka").fill("34 ABC 12");
  await shuttle.getByLabel("Durak adı").fill("Kadıköy İskele");
  await shuttle.getByLabel("Kalkış saati").fill("2026-09-20T06:40");

  // Sağlayıcı sahte backend'de yok; idari bölüm elle seçilir (sirket-adres.spec.ts).
  await shuttle.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }).click();
  await shuttle.getByLabel("Ülke").selectOption({ label: "Türkiye" });
  await shuttle.getByLabel("İl", { exact: true }).selectOption({ label: "İstanbul" });
  await shuttle.getByLabel("İlçe").selectOption({ label: "Kadıköy" });
  await shuttle.getByLabel("Mahalle").fill("Caferağa");
  await shuttle.getByLabel("Cadde veya sokak").fill("Rıhtım Caddesi");
  await shuttle.getByLabel("Bina numarası").fill("1");
  await shuttle.getByLabel("Posta kodu").fill("34710");
  await shuttle.getByLabel("Enlem").fill("40.9925");
  await shuttle.getByLabel("Boylam").fill("29.0245");
  await shuttle.getByRole("button", { name: "Konumu onayla" }).click();

  await editor.getByRole("button", { name: "Ulaşım planını kaydet" }).click();
  await expect(editor.getByRole("status")).toHaveText("Ulaşım planı kaydedildi.");

  const first = await (await request.get(`${backendURL}/__test__/transport-requests?key=${stateKey}`)).json();
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({ method: "PUT", path: `/jobs/${openJobId}/transport-plan` });
  expect(first[0].body).toMatchObject({
    outboundMethod: "SHUTTLE",
    returnMethod: "CASH_ALLOWANCE",
    allowanceAmount: "150",
    shuttles: [
      {
        direction: "OUTBOUND",
        name: "Anadolu yakası servisi",
        plate: "34 ABC 12",
        capacity: 12,
        stops: [
          {
            label: "Kadıköy İskele",
            // İstanbul 06:40 → UTC 03:40.
            scheduledAt: "2026-09-20T03:40:00Z",
            address: {
              districtId: kadikoyDistrictId,
              components: { neighborhood: "Caferağa", thoroughfare: "Rıhtım Caddesi", buildingNumber: "1", postalCode: "34710" },
              position: { latitude: 40.9925, longitude: 29.0245, source: "USER_CONFIRMED_PIN" },
            },
          },
        ],
      },
    ],
  });
  expect(first[0].body.shuttles[0]).not.toHaveProperty("id");
  expect(JSON.stringify(first[0].body)).not.toMatch(/"key"|savedAddress|editingAddress|seatsTaken/);

  // Form sunucunun planından yeniden kuruldu: kayıtlı adres satırla, servis kimlikli.
  await expect(shuttle.getByText(/Rıhtım Caddesi No: 1/)).toBeVisible();
  await expect(shuttle.getByRole("button", { name: "Adresi değiştir" })).toBeVisible();
  await shuttle.getByLabel("Koltuk sayısı").fill("14");
  await editor.getByRole("button", { name: "Ulaşım planını kaydet" }).click();
  // İlk kaydın durum satırı hâlâ ekranda; ikinci turun bittiğini kayıt
  // günlüğü söylüyor.
  await expect
    .poll(async () => ((await (await request.get(`${backendURL}/__test__/transport-requests?key=${stateKey}`)).json()) as unknown[]).length)
    .toBe(2);
  await expect(editor.getByRole("button", { name: "Ulaşım planını kaydet" })).toBeEnabled();

  const second = await (await request.get(`${backendURL}/__test__/transport-requests?key=${stateKey}`)).json();
  expect(second[1].body.shuttles[0]).toMatchObject({ id: "cccccccc-cccc-4ccc-8ccc-000000000100", capacity: 14 });
  expect(second[1].body.shuttles[0].stops[0]).toMatchObject({ id: "cccccccc-cccc-4ccc-8ccc-000000000200" });
  expect(second[1].body.shuttles[0].stops[0]).not.toHaveProperty("address");
});

test("kayıtlı planda koltuk seçilmiş servisi kaldırmak uyarır; kapasite reddi kendi cümlesiyle yazılır", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signIn({ context, request }, testInfo, "plan");

  await page.goto(`/isveren/ilan/${openJobId}`);
  const editor = page.getByRole("region", { name: "Ulaşım planı" });
  await expect(editor.getByLabel("Servis adı")).toHaveValue("Anadolu yakası servisi");
  await expect(editor.getByLabel("Plaka")).toHaveValue("34 ABC 12");
  await expect(editor.getByLabel("Kalkış saati").first()).toHaveValue("2026-09-20T06:40");

  // Sahte planda koltuk yok; uyarı yolunu istemci `seatsTaken` ile açıyor, o
  // yüzden önce iki atamaya koltuk seçtiriyoruz (işçi ucundan, aynı anahtarla).
  for (const assignmentId of [paidAssignmentId, unpaidAssignmentId]) {
    const seat = await request.put(`${backendURL}/job-assignments/${assignmentId}/transport/seat`, {
      headers: { authorization: `Bearer access-${stateKeyFor(testInfo)}`, "x-device-id": deviceId, "content-type": "application/json" },
      data: { shuttleId, stopId: bostanciStopId },
    });
    expect(seat.ok()).toBe(true);
  }
  await page.reload();
  await expect(editor.getByText(/2 koltuk seçilmiş/)).toBeVisible();

  await editor.getByRole("button", { name: "Servisi kaldır" }).click();
  await expect(editor.getByRole("alert")).toContainText("Bu serviste 2 koltuk seçilmiş");
  await editor.getByRole("button", { name: "Vazgeç" }).click();
  await expect(editor.getByLabel("Servis adı")).toBeVisible();

  // Kapasiteyi seçilmiş koltukların altına indirmek gönderimden önce durur;
  // backend'in 409'u yalnız yarış yedeği.
  await editor.getByLabel("Koltuk sayısı").fill("1");
  await editor.getByRole("button", { name: "Ulaşım planını kaydet" }).click();
  await expect(editor.getByText("Bu serviste 2 koltuk seçilmiş; sayı bunun altına inemez.")).toBeVisible();
});

test("çalışan servis durağını seçer; plaka ve yol tarifi yalnız seçtiği serviste görünür", async ({
  page,
  context,
  request,
}, testInfo) => {
  const stateKey = await signIn({ context, request }, testInfo, "plan");

  await page.goto(`/panel/is/${paidAssignmentId}`);
  const card = page.getByTestId("work-transport");
  await expect(card.getByRole("heading", { name: "Ulaşım" })).toBeVisible();
  await expect(card).toContainText("Servis 5 dk bekler.");
  await expect(card.getByTestId("work-transport-RETURN")).toContainText("Yol parası: 150,00 ₺");
  await expect(card).toContainText("Henüz durak seçmedin");
  // Koltuk yokken plaka ve şoför gelmiyor.
  await expect(card).not.toContainText("34 ABC 12");
  await expect(card).not.toContainText("Mehmet Şoför");
  await expect(card.getByRole("link", { name: "Yol tarifi al" })).toHaveCount(0);

  await card.getByRole("radio", { name: /Bostancı/ }).check();
  await card.getByRole("button", { name: "Koltuğu seç" }).click();

  await expect(card).toContainText("Seçtiğin durak");
  await expect(card).toContainText("34 ABC 12");
  await expect(card).toContainText("Mehmet Şoför");
  await expect(card.getByRole("link", { name: "Yol tarifi al" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=40.9612%2C29.0866&travelmode=transit",
  );
  await expect(card.getByRole("button", { name: "Koltuğu değiştir" })).toBeDisabled();

  const requests = await (await request.get(`${backendURL}/__test__/transport-requests?key=${stateKey}`)).json();
  expect(requests).toEqual([
    { method: "PUT", path: `/job-assignments/${paidAssignmentId}/transport/seat`, body: { shuttleId, stopId: bostanciStopId } },
  ]);
});

test("dolu servise koltuk seçimi 409 ile reddedilir ve kendi cümlesiyle yazılır", async ({
  page,
  context,
  request,
}, testInfo) => {
  await signIn({ context, request }, testInfo, "race");

  await page.goto(`/panel/is/${paidAssignmentId}`);
  const card = page.getByTestId("work-transport");
  await card.getByRole("radio", { name: /Kadıköy İskele/ }).check();
  await card.getByRole("button", { name: "Koltuğu seç" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "boş koltuk" })).toContainText(
    "Bu serviste boş koltuk kalmadı.",
  );
  await expect(card).not.toContainText("Seçtiğin durak");
});

test("herkese açık ilan sayfası yalnız özeti gösterir: ilçe/semt ve saat, plaka ya da adres yok", async ({ page }) => {
  await page.goto(`/is-ilanlari/${openJobId}`);

  const section = page.getByRole("region", { name: "Ulaşım" });
  await expect(section).toBeVisible();
  await expect(section).toContainText("Servis (1 servis)");
  await expect(section).toContainText("Yol parası: 150,00 ₺");
  await expect(section).toContainText("Anadolu yakası servisi");
  await expect(section).toContainText("Kadıköy · Caferağa · 20 Eyl 06:40");
  const html = await page.content();
  expect(html).not.toMatch(/34 ABC 12|Mehmet Şoför|0500 000 00 00|Rıhtım Caddesi|Bağdat Caddesi/);
});

function stateKeyFor(testInfo: TestInfo) {
  return createHash("sha256")
    .update(`${testInfo.testId}:${testInfo.repeatEachIndex}:${testInfo.retry}`)
    .digest("hex")
    .slice(0, 16);
}
