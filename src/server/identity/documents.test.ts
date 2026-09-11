import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { submitIdentityDocuments } from "./documents";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

const identity = {
  firstName: "Yusuf",
  lastName: "Acmaci",
  birthDate: "1998-04-12",
  identityNumber: "10000000146",
  tcDocumentNumber: "A01A00000",
};

describe("TCKK belge yükleme", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ön ve arka fotoğrafı JSON kimlik parçasıyla belge ucuna gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({ status: "PENDING" })));
    vi.stubGlobal("fetch", fetchMock);
    const front = new File(["on"], "on.jpg", { type: "image/jpeg" });
    const back = new File(["arka"], "arka.jpg", { type: "image/jpeg" });

    await submitIdentityDocuments(identity, front, back);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/identity-documents");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);

    const body = init.body as FormData;
    const part = body.get("identity");
    expect(part).toBeInstanceOf(Blob);
    expect((part as Blob).type).toBe("application/json");
    expect(JSON.parse(await (part as Blob).text())).toEqual({
      firstName: identity.firstName,
      lastName: identity.lastName,
      birthDate: identity.birthDate,
      tcIdentityNumber: identity.identityNumber,
      tcDocumentNumber: identity.tcDocumentNumber,
    });
    expect(body.get("front")).toBe(front);
    expect(body.get("back")).toBe(back);
    expect((body.get("front") as File).name).toBe("on.jpg");
    expect((body.get("back") as File).name).toBe("arka.jpg");
  });
});
