import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const playSigningFingerprint = Array.from({ length: 32 }, () => "AA").join(":");
const debugFingerprint = Array.from({ length: 32 }, () => "BB").join(":");

describe("GET /.well-known/assetlinks.json", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Play imza bilgisiyle yönlendirmesiz JSON döner", async () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "com.iskoala.koala");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", playSigningFingerprint);

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.iskoala.koala",
          sha256_cert_fingerprints: [playSigningFingerprint],
        },
      },
    ]);
  });

  it("virgülle ayrılmış paketlerin her biri için aynı parmak izleriyle hedef üretir", async () => {
    vi.stubEnv(
      "ANDROID_APP_LINKS_PACKAGE_NAME",
      " com.iskoala.koala.staging , com.iskoala.koala ",
    );
    vi.stubEnv(
      "ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS",
      `${playSigningFingerprint},${debugFingerprint}`,
    );

    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.iskoala.koala.staging",
          sha256_cert_fingerprints: [playSigningFingerprint, debugFingerprint],
        },
      },
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.iskoala.koala",
          sha256_cert_fingerprints: [playSigningFingerprint, debugFingerprint],
        },
      },
    ]);
  });

  it("paket adı yoksa geçersiz belge yayımlamaz", () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", playSigningFingerprint);

    expect(GET().status).toBe(503);
  });

  it("listedeki tek bir geçersiz paket adı yanıtın tamamını düşürür", () => {
    vi.stubEnv("ANDROID_APP_LINKS_PACKAGE_NAME", "com.iskoala.koala,koala");
    vi.stubEnv("ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS", playSigningFingerprint);

    expect(GET().status).toBe(503);
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
