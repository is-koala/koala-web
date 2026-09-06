import { describe, expect, it } from "vitest";

import { formatMoney, sumMoney } from "./money";

describe("para biçimlendirme", () => {
  it("binlik ayracını nokta, kuruş ayracını virgül yapar", () => {
    expect(formatMoney("1500.00", "TRY")).toBe("1.500,00 ₺");
    expect(formatMoney("112.50", "TRY")).toBe("112,50 ₺");
    expect(formatMoney("1234567.89", "TRY")).toBe("1.234.567,89 ₺");
  });

  it("kuruşu olduğu gibi taşır", () => {
    expect(formatMoney("0.10", "TRY")).toBe("0,10 ₺");
  });

  it("çift duyarlığın taşıyamayacağı bir tutarı bile bozmadan yazar", () => {
    // Biçimlendirici sayıya hiç çevirmiyor: `Number("9007199254740993.99")`
    // bu değeri kaybediyor ve backend'in `BigDecimal` kuruşu ekranda
    // sessizce değişirdi.
    expect(formatMoney("9007199254740993.99", "TRY")).toBe("9.007.199.254.740.993,99 ₺");
  });

  it("tanımadığı para biriminde kodu olduğu gibi yazar", () => {
    expect(formatMoney("10.00", "USD")).toBe("10,00 USD");
  });

  it("beklediği biçimde olmayan değeri uydurmadan geri verir", () => {
    // Ham değeri göstermek, kuruş uydurmaktan iyidir.
    expect(formatMoney("0.075", "TRY")).toBe("0.075");
    expect(formatMoney("", "TRY")).toBe("");
  });

  it("sunucu tutarlarını Number sınırına girmeden kesin toplar", () => {
    expect(sumMoney(["9007199254740993.99", "0.01", "6.00"])).toBe(
      "9007199254741000.00",
    );
  });

  it("geçersiz bir tutar varsa yanlış toplam üretmez", () => {
    expect(sumMoney(["100.00", "bozuk"])).toBeNull();
  });
});
