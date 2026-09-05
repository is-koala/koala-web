import { afterEach, describe, expect, it, vi } from "vitest";

import { publicEnvironment } from "./env";

describe("public ortam doğrulaması", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("zorunlu değişken eksikse adıyla Türkçe hata verir", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "koala");
    expect(() => publicEnvironment()).toThrow("Zorunlu ortam değişkeni eksik: NEXT_PUBLIC_SITE_URL");
  });

  it("yalnız bilinen uygulama şemalarını kabul eder", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://iskoala.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "javascript");
    expect(() => publicEnvironment()).toThrow("koala-dev, koala-staging veya koala");
  });
});
