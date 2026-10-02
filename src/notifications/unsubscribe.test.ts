import { describe, expect, it } from "vitest";

import {
  unsubscribeFailure,
  unsubscribeOutcomeFrom,
  unsubscribeTokenFrom,
} from "./unsubscribe";

describe("abonelikten çıkma bağlantısının tokenı", () => {
  it("adres çubuğundaki tek tokenı okur", () => {
    expect(unsubscribeTokenFrom("?token=Abc-_123")).toBe("Abc-_123");
  });

  it("eksik, boş, tekrarlanan ya da aşırı uzun tokenı token saymaz", () => {
    // Backend `UnsubscribeDto.token` için `@NotBlank` ve 2048 sınırı koyuyor;
    // tekrarlanan parametrede hangisinin kastedildiği belli değil.
    expect(unsubscribeTokenFrom("")).toBeNull();
    expect(unsubscribeTokenFrom("?token=")).toBeNull();
    expect(unsubscribeTokenFrom("?token=%20%20")).toBeNull();
    expect(unsubscribeTokenFrom("?token=bir&token=iki")).toBeNull();
    expect(unsubscribeTokenFrom(`?token=${"a".repeat(2049)}`)).toBeNull();
  });
});

describe("abonelikten çıkma reddinin yönlendirilmesi", () => {
  it("süresi dolmuş bağlantıyı geçersizden ayırır", () => {
    expect(unsubscribeFailure("NOTIFICATION_UNSUBSCRIBE_TOKEN_EXPIRED", 400)).toEqual({
      outcome: "expired",
    });
  });

  it("tanınmayan ve biçimi bozuk tokenı geçersiz bağlantı sayar", () => {
    expect(unsubscribeFailure("NOTIFICATION_UNSUBSCRIBE_TOKEN_INVALID", 400)).toEqual({
      outcome: "invalid",
    });
    // Boş ya da 2048'den uzun token bean validation'a takılıyor
    // (`details[].field=token`); kullanıcı için ikisi de bozuk bağlantı.
    expect(unsubscribeFailure("VALIDATION_FAILED", 400)).toEqual({ outcome: "invalid" });
  });

  it("öbür her reddi kodu ve durumuyla genel hataya taşır", () => {
    expect(unsubscribeFailure("TOO_MANY_REQUESTS", 429)).toEqual({
      outcome: "failed",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(unsubscribeFailure("UNEXPECTED", 500)).toEqual({
      outcome: "failed",
      errorCode: "UNEXPECTED",
      httpStatus: 500,
    });
  });
});

describe("BFF yanıtının okunması", () => {
  it("kapatılan kategori ve kanalı taşır", () => {
    expect(
      unsubscribeOutcomeFrom(200, {
        outcome: "unsubscribed",
        category: "MARKETINGS",
        channel: "EMAIL",
        alreadyDisabled: false,
      }),
    ).toEqual({
      outcome: "unsubscribed",
      category: "MARKETINGS",
      channel: "EMAIL",
      alreadyDisabled: false,
    });
  });

  it("ikinci tıkı hata değil, zaten kapalı bir başarı olarak okur", () => {
    expect(
      unsubscribeOutcomeFrom(200, {
        outcome: "unsubscribed",
        category: "NEWSLETTER",
        channel: "EMAIL",
        alreadyDisabled: true,
      }),
    ).toMatchObject({ outcome: "unsubscribed", alreadyDisabled: true });
  });

  it("bağlantı sorunlarını ayrı ayrı okur", () => {
    expect(unsubscribeOutcomeFrom(400, { outcome: "expired" })).toEqual({ outcome: "expired" });
    expect(unsubscribeOutcomeFrom(400, { outcome: "invalid" })).toEqual({ outcome: "invalid" });
  });

  it("tanınmayan gövdeyi yanıt durumuyla nötr hataya düşürür", () => {
    // Ters vekil HTML ya da boş gövde döndürebilir; sonuç asla başarı sayılmaz.
    expect(unsubscribeOutcomeFrom(502, null)).toEqual({
      outcome: "failed",
      errorCode: "UNEXPECTED",
      httpStatus: 502,
    });
    expect(unsubscribeOutcomeFrom(200, { outcome: "bilinmeyen" })).toEqual({
      outcome: "failed",
      errorCode: "UNEXPECTED",
      httpStatus: 500,
    });
    expect(
      unsubscribeOutcomeFrom(429, { outcome: "failed", errorCode: "TOO_MANY_REQUESTS", httpStatus: 429 }),
    ).toEqual({ outcome: "failed", errorCode: "TOO_MANY_REQUESTS", httpStatus: 429 });
  });
});
