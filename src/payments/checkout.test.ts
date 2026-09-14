import { describe, expect, it } from "vitest";

import {
  firstSucceededCompletedAt,
  hasUnresolvedPaymentAttempt,
  isAllowedPaymentPageUrl,
  paymentAttemptLabel,
  paymentStatusLabel,
  paymentStatusPresentation,
} from "./checkout";

describe("yeniden ödeme başlatma kapısı", () => {
  it.each(["INITIATED", "IN_REVIEW", "VERIFY_PENDING"] as const)(
    "%s denemesi kesinleşmeden yeni checkout açılmasına izin vermez",
    (status) => {
      expect(hasUnresolvedPaymentAttempt([{ status }])).toBe(true);
    },
  );

  it("bilinmeyen denemeyi de finansal sonuç kesinleşene kadar kilitli tutar", () => {
    expect(hasUnresolvedPaymentAttempt([
      { status: "FAILED" },
      { status: "SUCCEEDED" },
      { status: "UNKNOWN" },
    ])).toBe(true);
  });

  it("kesinleşmemiş deneme listenin ortasında olsa da checkout'u kilitler", () => {
    expect(hasUnresolvedPaymentAttempt([
      { status: "FAILED" },
      { status: "IN_REVIEW" },
      { status: "SUCCEEDED" },
    ])).toBe(true);
  });
});

describe("Iyzico ödeme sayfası doğrulaması", () => {
  it("resmî CF yanıtlarında kullanılan HTTPS Iyzico ana makinelerini kabul eder", () => {
    expect(isAllowedPaymentPageUrl("https://sandbox-cpp.iyzipay.com?token=token&lang=tr")).toBe(true);
    expect(isAllowedPaymentPageUrl("https://sandbox-api.iyzipay.com/checkoutform/token")).toBe(true);
    expect(isAllowedPaymentPageUrl("https://cpp.iyzipay.com?token=token&lang=tr")).toBe(true);
    expect(isAllowedPaymentPageUrl("https://api.iyzipay.com/checkoutform/token")).toBe(true);

    expect(isAllowedPaymentPageUrl("http://sandbox-cpp.iyzipay.com/?token=token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://user:pass@sandbox-cpp.iyzipay.com/?token=token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://sandbox-cpp.iyzipay.com:443/?token=token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://sandbox-cpp.iyzipay.com:8443/?token=token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://sandbox-cpp.iyzipay.com/?token=token#done")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://sandbox-cpp.iyzipay.com.evil.test/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://iyzipay.com/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("not a url")).toBe(false);
  });
});

describe("ödeme durumu sunumu", () => {
  it("backend'in tanımadığımız durumlarında ekranı kırmadan nötr etikete düşer", () => {
    expect(paymentStatusLabel("CHARGEBACK")).toBe("Durum güncelleniyor");
    expect(paymentAttemptLabel("VERIFY_PENDING")).toBe("Sonuç doğrulanıyor");
  });

  it("genel iade durumunu sağlayıcı tamamlanmasını iddia etmeden süreç olarak sunar", () => {
    expect(paymentStatusPresentation("HELD_IN_ESCROW")).toMatchObject({ resolution: "held" });
    expect(paymentStatusPresentation("RELEASED_TO_WORKER")).toMatchObject({ resolution: "released" });
    expect(paymentStatusPresentation("REFUNDED")).toEqual({
      label: "İade sürecinde",
      tone: "neutral",
      resolution: "pending",
    });
  });
});

describe("firstSucceededCompletedAt", () => {
  it("ilk başarılı denemenin tamamlanma anını verir; başarılı deneme yoksa null", () => {
    // İki ekran (çalışan iş ayrıntısı, işveren atama ayrıntısı) aynı satırı
    // bu tek kuraldan türetiyor.
    expect(
      firstSucceededCompletedAt([
        { status: "SUCCEEDED", completedAt: "2026-09-03T10:00:00Z" },
        { status: "FAILED", completedAt: "2026-09-01T10:00:00Z" },
        { status: "SUCCEEDED", completedAt: "2026-09-02T11:00:00Z" },
        { status: "SUCCEEDED", completedAt: null },
      ]),
    ).toBe("2026-09-02T11:00:00Z");
    expect(firstSucceededCompletedAt([{ status: "FAILED", completedAt: "2026-09-01T10:00:00Z" }])).toBeNull();
    expect(firstSucceededCompletedAt([])).toBeNull();
  });
});
