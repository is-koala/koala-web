import { describe, expect, it } from "vitest";

import { createAnalyticsQuota } from "./rate-limit";

function requestFrom(address: string) {
  return new Request("https://iskoala.com/api/analytics/events", {
    headers: { "x-real-ip": address },
  });
}

describe("analytics kotası", () => {
  it("istemci ve süreç toplamını ayrı sınırlar", () => {
    const take = createAnalyticsQuota({ clientLimit: 2, globalLimit: 3 });

    expect(take(requestFrom("198.51.100.1")).allowed).toBe(true);
    expect(take(requestFrom("198.51.100.1")).allowed).toBe(true);
    expect(take(requestFrom("198.51.100.1")).allowed).toBe(false);
    expect(take(requestFrom("198.51.100.2")).allowed).toBe(true);
    expect(take(requestFrom("198.51.100.3")).allowed).toBe(false);
  });

  it("istemci kovalarını sınırlı tutar ve pencere sonunda temizler", () => {
    let now = 1_000;
    const take = createAnalyticsQuota({
      maxClientBuckets: 1,
      now: () => now,
      windowMs: 1_000,
    });

    expect(take(requestFrom("198.51.100.1")).allowed).toBe(true);
    expect(take(requestFrom("198.51.100.2")).allowed).toBe(false);

    now = 2_000;
    expect(take(requestFrom("198.51.100.2")).allowed).toBe(true);
  });
});
