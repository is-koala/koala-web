import { describe, expect, it } from "vitest";

import { createIdentityUploadQuota } from "./upload-rate-limit";

describe("kimlik yükleme kotası", () => {
  it("büyük gövdeyi okumadan önce cihaz ve süreç toplamını sınırlar", () => {
    let now = 1_000;
    const take = createIdentityUploadQuota({
      clientLimit: 2,
      globalLimit: 3,
      now: () => now,
      windowMs: 60_000,
    });

    expect(take("device-a").allowed).toBe(true);
    expect(take("device-a").allowed).toBe(true);
    expect(take("device-a")).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
    expect(take("device-b").allowed).toBe(true);
    expect(take("device-c")).toMatchObject({ allowed: false, retryAfterSeconds: 60 });

    now += 60_000;
    expect(take("device-a").allowed).toBe(true);
  });
});
