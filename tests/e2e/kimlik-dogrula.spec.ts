import { expect, test } from "@playwright/test";

test("oturumsuz kimlik ekranı girişe düşer ve hedefini taşır", async ({ request }) => {
  const response = await request.get("/kimlik-dogrula?next=%2Fisveren%2Filan%2Fyeni", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe(
    "/giris?next=%2Fkimlik-dogrula%3Fnext%3D%252Fisveren%252Filan%252Fyeni",
  );
});

test("kimlik fotoğrafı yükleme ucu same-origin ve oturum kapılarının arkasında kalır", async ({
  request,
  baseURL,
}) => {
  const withoutOrigin = await request.post("/api/users/me/identity-documents");
  expect(withoutOrigin.status()).toBe(403);

  const foreign = await request.post("/api/users/me/identity-documents", {
    headers: { origin: "https://baska-site.example" },
  });
  expect(foreign.status()).toBe(403);

  const sameOrigin = await request.post("/api/users/me/identity-documents", {
    headers: { origin: baseURL! },
  });
  expect(sameOrigin.status()).toBe(401);
  expect(await sameOrigin.json()).toEqual({
    status: "error",
    errorCode: "AUTHENTICATION_REQUIRED",
    httpStatus: 401,
  });
});

test("kimlik BFF stub'ı çip gövdesini backend'e taşımadan 501 döner", async ({
  request,
  baseURL,
}) => {
  const chipBody = {
    tcIdentityNumber: "12345678901",
    sod: "c29k",
    dg1: "ZGcx",
  };

  for (const path of [
    "/api/users/me/identity-verification",
    "/api/users/me/identity-verification/challenge",
  ]) {
    const forbidden = await request.post(path, { data: chipBody });
    expect(forbidden.status(), path).toBe(403);

    const response = await request.post(path, {
      headers: { origin: baseURL! },
      data: chipBody,
    });
    expect(response.status(), path).toBe(501);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers().location).toBe("/kimlik-dogrula");
    const body = await response.text();
    expect(body).toBe(
      '{"errorCode":"IDENTITY_CHIP_PA_NOT_AVAILABLE_ON_WEB","httpStatus":501}',
    );
    expect(body).not.toContain("12345678901");
    expect(body).not.toContain("sod");
  }
});
