import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const playSigningFingerprint = Array.from({ length: 32 }, () => "AA").join(":");

describe("GET /.well-known/assetlinks.json", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Play imza bilgisiyle yönlendirmesiz JSON döner", () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "com.iskoala.koala");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", playSigningFingerprint);

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toBeNull();
  });

  it("parmak izi yoksa geçersiz belge yayımlamaz", () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "com.iskoala.koala");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", "");

    expect(GET().status).toBe(503);
  });

  it("SHA-256 olmayan parmak izini yayımlamaz", () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "com.iskoala.koala");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", "AA:BB");

    expect(GET().status).toBe(503);
  });
});
