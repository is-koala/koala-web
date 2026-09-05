import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "./instrumentation";

describe("sunucu açılış doğrulaması", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("eksik yapılandırmayı ilk istekte değil açılışta bildirir", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("APP_VERSION", "1.4.0");

    expect(() => register()).toThrow("Zorunlu ortam değişkeni eksik: API_URL");
  });

  it("yapılandırma tamsa açılışı engellemez", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("API_URL", "https://api.iskoala.com");
    vi.stubEnv("APP_VERSION", "1.4.0");

    expect(() => register()).not.toThrow();
  });
});
