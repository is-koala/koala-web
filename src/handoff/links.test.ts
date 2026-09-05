import { describe, expect, it } from "vitest";
import {
  buildAndroidIntentUrl,
  buildAndroidPaymentResultIntentUrl,
  buildAppLink,
  resolvePlatform,
  storeUrl,
} from "./links";

describe("uygulamaya aktarım bağlantıları", () => {
  it.each([
    ["Mozilla/5.0 (iPhone)", "ios"],
    ["Mozilla/5.0 (Linux; Android 15)", "android"],
    ["Mozilla/5.0 (Macintosh)", "desktop"],
    [null, "desktop"],
  ] as const)("platformu istemci bilgisinden çözer", (userAgent, expected) => {
    expect(resolvePlatform(userAgent)).toBe(expected);
  });

  it("tokenı host üzerinde, pathsiz ve güvenli kodlanmış üretir", () => {
    expect(
      buildAppLink({
        destination: "hesap-dogrula",
        token: "a b&c",
        scheme: "koala-staging",
      }),
    ).toBe("koala-staging://hesap-dogrula?token=a%20b%26c");
  });

  it("Android intent bağlantısına paket ve mağaza yedeğini koyar", () => {
    const result = buildAndroidIntentUrl({
      destination: "sifre-sifirla",
      token: "reset-token",
      scheme: "koala",
      packageId: "com.iskoala.koala",
      fallbackUrl: "https://play.google.com/store/apps/details?id=com.iskoala.koala",
    });

    expect(result).toContain("intent://sifre-sifirla?token=reset-token#Intent;");
    expect(result).toContain("scheme=koala;");
    expect(result).toContain("package=com.iskoala.koala;");
    expect(result).toContain("S.browser_fallback_url=https%3A%2F%2Fplay.google.com");
    expect(result).toMatch(/;end$/);
  });

  it("ödeme sonucu için Android intent ve mağaza yedeği üretir", () => {
    expect(buildAndroidPaymentResultIntentUrl({
      status: "failed",
      assignmentId: "atama 1",
      scheme: "koala-staging",
      packageId: "com.iskoala.koala.staging",
      fallbackUrl: "https://play.google.com/store/apps/details?id=com.iskoala.koala.staging",
    })).toBe(
      "intent://payment-result?status=failed&assignmentId=atama+1#Intent;scheme=koala-staging;package=com.iskoala.koala.staging;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.iskoala.koala.staging;end",
    );
  });

  it("mağaza kimliği yoksa ölü bağlantı üretmez", () => {
    expect(storeUrl("ios", {})).toBeNull();
    expect(storeUrl("android", {})).toBeNull();
    expect(storeUrl("desktop", {})).toBeNull();
  });
});
