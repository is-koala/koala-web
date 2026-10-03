import { expect, test } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = `http://localhost:${webPort}`;

/**
 * JavaScript'siz (ve hidrasyon öncesi) server action gönderimi
 * (is-koala/koala-web#199).
 *
 * Hidrasyondan önce form düz bir HTML POST'u olarak gidiyor. Gizli rotalar
 * `Referrer-Policy: no-referrer` taşıdığında Fetch standardı bu POST'a
 * `Origin: null` yazdırıyordu; `src/proxy.ts` 403, Next'in action CSRF
 * denetimi 500 döndürüyordu. Politika `strict-origin`: aynı origin POST'u
 * gerçek origin'i taşır, iki denetim de gevşemeden geçer.
 */
test("JavaScript kapalıyken giriş formu gönderilir ve ret metni çizilir", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/giris");
  await page.getByLabel("E-posta").fill("aile-kodu@example.test");
  await page.getByLabel("Parola").fill("Koala2026");
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && new URL(candidate.url()).pathname === "/giris",
    ),
    page.getByRole("button", { name: "Giriş yap" }).click(),
  ]);

  expect(await response.request().headerValue("origin")).toBe(baseURL);
  expect(response.status()).toBe(200);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Bilgileri kontrol et");
  await context.close();
});

test("JavaScript kapalıyken çıkış formu gönderilir", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/cikis");
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && new URL(candidate.url()).pathname === "/cikis",
    ),
    page.getByRole("button", { name: "Çıkış yap" }).click(),
  ]);

  expect(await response.request().headerValue("origin")).toBe(baseURL);
  expect(response.status()).not.toBe(403);
  await expect(page).toHaveURL(`${baseURL}/`);
  await context.close();
});

test("gizli sayfanın kendi istekleri Referer'a yalnız origin'i yazar", async ({ page }) => {
  // `strict-origin`: yol ve sorgu (tokenlı karşılama adresleri, davet
  // kimliği) hiçbir isteğe girmez. `document.referrer` `page.goto`'da zaten
  // boş, bir şey kanıtlamıyor; ölçülen şey sayfanın attığı aynı origin
  // isteğinin başlığı.
  const scriptRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname.startsWith("/_next/static/"),
  );
  const response = await page.goto("/sifre-sifirla?token=gizli-sifirlama-tokeni");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin");

  const referer = await (await scriptRequest).headerValue("referer");
  expect(referer).toBe(`${baseURL}/`);
  expect(referer).not.toContain("gizli");
});

test("tanıtım sayfası da strict-origin taşır", async ({ request }) => {
  // İstemci tarafı gezinme belge politikasını değiştirmiyor: tanıtım
  // sayfasından `/panel/**`'e geçen belge ilk yüklemenin politikasını korur.
  for (const path of ["/", "/is-ilanlari"]) {
    const response = await request.get(path);
    expect(response.headers()["referrer-policy"], path).toBe("strict-origin");
  }
});

test("çapraz origin ve null origin POST'u yine reddedilir", async ({ request }) => {
  // Politika değişikliği CSRF kapısını gevşetmez: vekil yalnız aynı origin'i kabul ediyor.
  for (const origin of ["https://kotu.example", "null"]) {
    const response = await request.post("/giris", {
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      data: "email=a%40example.test&password=x",
      maxRedirects: 0,
    });
    expect(response.status(), origin).toBe(403);
  }
});
