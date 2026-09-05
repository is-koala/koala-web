import { afterEach, describe, expect, it, vi } from "vitest";

import { serverEnvironment } from "./env";

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

  it("geçerli değerlerde backend adresinin sonundaki eğik çizgiyi atar", () => {
    stubServerEnv("https://api.iskoala.com/", "1.4.0-rc.1");
    expect(serverEnvironment()).toEqual({
      apiUrl: "https://api.iskoala.com",
      appVersion: "1.4.0-rc.1",
    });
  });
});
