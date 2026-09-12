import { expect, test } from "@playwright/test";

const appPort = process.env.SITEMAP_PLAYWRIGHT_PORT ?? "3410";
const appURL = `http://127.0.0.1:${appPort}`;
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const stateKey = "1450145014501450";

test("üretim sunucusu 11 MiB üzerindeki dört fotoğrafı Route Handler'a ulaştırır", async ({
  context,
}) => {
  await context.addCookies([
    { name: "koala_at", value: `access-${stateKey}`, url: appURL },
    { name: "koala_rt", value: "refresh-placeholder", url: appURL },
    { name: "koala_did", value: deviceId, url: appURL },
  ]);

  const photo = Buffer.alloc(4 * 1024 * 1024);
  const response = await context.request.post("/api/users/me/identity-documents", {
    headers: { origin: appURL },
    multipart: {
      firstName: "E2E",
      lastName: "Kullanıcı",
      birthDate: "1998-04-12",
      identityNumber: "10000000146",
      tcDocumentNumber: "A01A00000",
      selfie: { name: "yuz.jpg", mimeType: "image/jpeg", buffer: photo },
      front: { name: "on.jpg", mimeType: "image/jpeg", buffer: photo },
      back: { name: "arka.jpg", mimeType: "image/jpeg", buffer: photo },
      together: { name: "birlikte.jpg", mimeType: "image/jpeg", buffer: photo },
    },
    timeout: 120_000,
  });

  expect(response.status()).toBe(201);
  expect(await response.json()).toEqual({ status: "done" });
});
