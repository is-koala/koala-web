import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "./instrumentation";

const sentry = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

describe("sunucu açılış doğrulaması", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("eksik yapılandırmayı ilk istekte değil açılışta bildirir", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("APP_VERSION", "1.4.0");

    await expect(register()).rejects.toThrow("Zorunlu ortam değişkeni eksik: API_URL");
  });

  it("yapılandırma tamsa açılışı engellemez", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("API_URL", "https://api.iskoala.com");
    vi.stubEnv("APP_VERSION", "1.4.0");

    await expect(register()).resolves.toBeUndefined();
    expect(sentry.init).toHaveBeenCalledOnce();
  });
});
