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
