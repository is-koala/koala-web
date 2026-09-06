import { expect, test } from "@playwright/test";

const sessionId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

test("adres oturumu açma isteği çapraz origin'den geçmez", async ({ request, baseURL }) => {
  // Cookie tabanlı oturumun CSRF yüzeyini `src/proxy.ts` kapatıyor; yeni
  // durum değiştiren uçların da o kapının arkasında kaldığı burada sabitlenir.
  const withoutOrigin = await request.post("/api/address/search-sessions");
  expect(withoutOrigin.status()).toBe(403);

  const foreign = await request.post("/api/address/search-sessions", {
    headers: { origin: "https://baska-site.example" },
  });
  expect(foreign.status()).toBe(403);

  const sameOrigin = await request.post("/api/address/search-sessions", {
    headers: { origin: baseURL! },
  });
  expect(sameOrigin.status()).toBe(401);
});

test("oturumsuz adres isteği backend adresini ve ham mesajı sızdırmaz", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/address/search-sessions", {
    headers: { origin: baseURL! },
  });

  expect(await response.json()).toEqual({
    errorCode: "AUTHENTICATION_REQUIRED",
    httpStatus: 401,
  });
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("kısa sorgu sağlayıcıya hiç gitmeden reddedilir", async ({ request }) => {
  const response = await request.get(
    `/api/address/search-sessions/${sessionId}/suggestions?query=le`,
  );

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    errorCode: "ADDRESS_SEARCHQUERY_INVALID",
    httpStatus: 400,
  });
});
