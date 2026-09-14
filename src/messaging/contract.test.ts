import { describe, expect, it } from "vitest";

import { messagingAvailabilityFrom, normalizeSenderName } from "./contract";

describe("mesajlaşma kapısının atama yanıtından okunması", () => {
  it("üç nedeni sunucunun yazdığı gibi taşır", () => {
    expect(messagingAvailabilityFrom({
      messagingAvailable: true,
      messagingAvailableReason: "AVAILABLE",
    })).toEqual({ available: true, reason: "AVAILABLE" });
    expect(messagingAvailabilityFrom({
      messagingAvailable: false,
      messagingAvailableReason: "PAYMENT_REQUIRED",
    })).toEqual({ available: false, reason: "PAYMENT_REQUIRED" });
    expect(messagingAvailabilityFrom({
      messagingAvailable: false,
      messagingAvailableReason: "CLOSED",
    })).toEqual({ available: false, reason: "CLOSED" });
  });

  it("alanı taşımayan yanıtta karar üretmez", () => {
    // Eski önbellek ya da alanı henüz taşımayan uç: ekran mesaj bağlantısını
    // hiç çizmez; "ödeme gerekli" demek yanlış bir sebep söylemek olurdu.
    expect(messagingAvailabilityFrom({})).toBeNull();
    expect(messagingAvailabilityFrom({
      messagingAvailable: null,
      messagingAvailableReason: "AVAILABLE",
    })).toBeNull();
  });

  it("bayrak açıkken nedene bakmaz, kapalıyken tanımadığı nedeni karar saymaz", () => {
    expect(messagingAvailabilityFrom({ messagingAvailable: true })).toEqual({
      available: true,
      reason: "AVAILABLE",
    });
    expect(messagingAvailabilityFrom({
      messagingAvailable: false,
      messagingAvailableReason: "SOMETHING_NEW",
    })).toBeNull();
    expect(messagingAvailabilityFrom({ messagingAvailable: false })).toBeNull();
  });
});

describe("normalizeSenderName", () => {
  it("boş, boşluk ve dize olmayan değeri null'a indirir; adı kırpar", () => {
    expect(normalizeSenderName(undefined)).toBeNull();
    expect(normalizeSenderName(null)).toBeNull();
    expect(normalizeSenderName("   ")).toBeNull();
    expect(normalizeSenderName(42)).toBeNull();
    expect(normalizeSenderName("  Ece Yılmaz ")).toBe("Ece Yılmaz");
  });
});
