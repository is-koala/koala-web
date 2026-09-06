import { describe, expect, it } from "vitest";

import {
  isAllowedPaymentPageUrl,
  paymentAttemptLabel,
  paymentStatusLabel,
  paymentStatusPresentation,
} from "./checkout";

describe("Iyzico ödeme sayfası doğrulaması", () => {
  it("yalnız HTTPS kullanan iki kanonik Iyzico ana makinesini kabul eder", () => {
    expect(isAllowedPaymentPageUrl("https://payment.iyzipay.com/checkout/form/token")).toBe(true);
    expect(isAllowedPaymentPageUrl("https://sandbox-payment.iyzipay.com/checkout/form/token")).toBe(true);

    expect(isAllowedPaymentPageUrl("http://payment.iyzipay.com/checkout/form/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://user:pass@payment.iyzipay.com/checkout/form/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://payment.iyzipay.com:443/checkout/form/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://payment.iyzipay.com:8443/checkout/form/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://payment.iyzipay.com/checkout/form/token#done")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://payment.iyzipay.com.evil.test/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("https://iyzipay.com/token")).toBe(false);
    expect(isAllowedPaymentPageUrl("not a url")).toBe(false);
  });
});

describe("ödeme durumu sunumu", () => {
  it("backend'in tanımadığımız durumlarında ekranı kırmadan nötr etikete düşer", () => {
    expect(paymentStatusLabel("CHARGEBACK")).toBe("Durum güncelleniyor");
    expect(paymentAttemptLabel("VERIFY_PENDING")).toBe("Sonuç doğrulanıyor");
  });

  it("emanet, aktarım ve iadeyi tek typed metadata haritasında ayrı tutar", () => {
    expect(paymentStatusPresentation("HELD_IN_ESCROW")).toMatchObject({ resolution: "held" });
    expect(paymentStatusPresentation("RELEASED_TO_WORKER")).toMatchObject({ resolution: "released" });
    expect(paymentStatusPresentation("REFUNDED")).toMatchObject({ resolution: "refunded" });
  });
});
