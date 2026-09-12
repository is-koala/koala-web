import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bffUpstreamTimeoutMs,
  identityUploadBodyIdleTimeoutMs,
  identityUploadMaxConcurrentOperations,
  serverEnvironment,
} from "./env";

function stubServerEnv(apiUrl: string, appVersion: string) {
  vi.stubEnv("API_URL", apiUrl);
  vi.stubEnv("APP_VERSION", appVersion);
}

describe("sunucu ortam doğrulaması", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("backend adresi eksikse adıyla Türkçe hata verir", () => {
    stubServerEnv("", "1.4.0");
    expect(() => serverEnvironment()).toThrow("Zorunlu ortam değişkeni eksik: API_URL");
  });

  it("backend adresi mutlak URL değilse reddeder", () => {
    stubServerEnv("api.iskoala.com", "1.4.0");
    expect(() => serverEnvironment()).toThrow("API_URL geçerli bir mutlak URL olmalı.");
  });

  it("web sürümü eksikse adıyla Türkçe hata verir", () => {
    stubServerEnv("https://api.iskoala.com", "");
    expect(() => serverEnvironment()).toThrow("Zorunlu ortam değişkeni eksik: APP_VERSION");
  });

  it("backend sürüm kapısının okuyamayacağı sürümü reddeder", () => {
    stubServerEnv("https://api.iskoala.com", "development");
    expect(() => serverEnvironment()).toThrow(
      "APP_VERSION 1.4.0 gibi noktayla ayrılmış sayılarla başlamalı.",
    );
  });

  it("kanıt deposu allowlist'inde HTTPS olmayan origin'i açılışta reddeder", () => {
    stubServerEnv("https://api.iskoala.com", "1.4.0");
    vi.stubEnv("EVIDENCE_STORAGE_ORIGINS", "http://objects.example.test");

    expect(() => serverEnvironment()).toThrow(
      "EVIDENCE_STORAGE_ORIGINS yalnız geçerli HTTPS origin'leri içermeli.",
    );
  });

  it("kanıt indirme timeout'unu kısa ve pozitif bir tam sayı olarak doğrular", () => {
    expect(bffUpstreamTimeoutMs()).toBe(15_000);

    for (const value of ["0", "999", "60001", "1.5", "sonsuz"]) {
      vi.stubEnv("BFF_UPSTREAM_TIMEOUT_MS", value);
      expect(() => bffUpstreamTimeoutMs()).toThrow(
        "BFF_UPSTREAM_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.",
      );
    }

    vi.stubEnv("BFF_UPSTREAM_TIMEOUT_MS", "8000");
    expect(bffUpstreamTimeoutMs()).toBe(8000);
  });

  it("kimlik yüklemesinin eşzamanlı büyük işlemlerini yapılandırır", () => {
    expect(identityUploadMaxConcurrentOperations()).toBe(2);

    for (const value of ["0", "9", "1.5", "sınırsız"]) {
      vi.stubEnv("IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS", value);
      expect(() => identityUploadMaxConcurrentOperations()).toThrow(
        "IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS 1 ile 8 arasında bir tam sayı olmalı.",
      );
    }

    vi.stubEnv("IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS", "4");
    expect(identityUploadMaxConcurrentOperations()).toBe(4);
  });

  it("kimlik yüklemesinde parçalar arası bekleme süresini yapılandırır", () => {
    expect(identityUploadBodyIdleTimeoutMs()).toBe(15_000);

    for (const value of ["999", "60001", "1.5", "sınırsız"]) {
      vi.stubEnv("IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS", value);
      expect(() => identityUploadBodyIdleTimeoutMs()).toThrow(
        "IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.",
      );
    }

    vi.stubEnv("IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS", "8000");
    expect(identityUploadBodyIdleTimeoutMs()).toBe(8000);
  });

  it("geçerli değerlerde backend adresinin sonundaki eğik çizgiyi atar", () => {
    stubServerEnv("https://api.iskoala.com/", "1.4.0-rc.1");
    expect(serverEnvironment()).toEqual({
      apiUrl: "https://api.iskoala.com",
      appVersion: "1.4.0-rc.1",
    });
  });
});
