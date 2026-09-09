import { describe, expect, it } from "vitest";

import { safeExternalUrl, safeImageUrl, safeInternalPath } from "./urls";

describe("site içi bağlantı adresi", () => {
  it("aynı kökendeki yolu sorgu ve parçasıyla geçirir", () => {
    expect(safeInternalPath("/giris?next=%2Fpanel%2Fislerim#form")).toBe(
      "/giris?next=%2Fpanel%2Fislerim#form",
    );
  });

  it("güvenli yol, sorgu, parça ve yüzde kodlamasını değiştirmez", () => {
    expect(safeInternalPath("/ilanlar/%E2%9C%93?q=a%2Fb#c%20d")).toBe(
      "/ilanlar/%E2%9C%93?q=a%2Fb#c%20d",
    );
    expect(safeInternalPath("/oran%2525?next=%2F%2Fexample.test#sonuc")).toBe(
      "/oran%2525?next=%2F%2Fexample.test#sonuc",
    );
  });

  it("üç decode katmanını kabul eder, dördüncü katmanda kapalı kalır", () => {
    expect(safeInternalPath("/oran%252525?q=%2Fpanel#sonuc")).toBe(
      "/oran%252525?q=%2Fpanel#sonuc",
    );
    expect(safeInternalPath("/oran%25252525?q=%2Fpanel#sonuc")).toBeNull();
  });

  it.each(["/a/..//evil.example", "/%2e%2e//evil.example"])(
    "%s yolunun normalizasyonla dış hedefe dönüşmesine izin vermez",
    (value) => {
      expect(safeInternalPath(value)).toBeNull();
    },
  );

  it.each([
    "/%252e%252e/%252f%252fevil.example",
    "/%252f%252fevil.example",
    "/a/%255c%255cevil.example",
    "/a/%2509/%252f%252fevil.example",
  ])("%s yolundaki katmanlı kodlamayı güvenli hedef saymaz", (value) => {
    expect(safeInternalPath(value)).toBeNull();
  });

  it.each([
    "",
    "giris",
    "https://kotu.example/giris",
    "javascript:alert(1)",
    "//kotu.example/giris",
    "/\\kotu.example/giris",
    "/\t/kotu.example/giris",
    "/\n/kotu.example/giris",
    "/\r/kotu.example/giris",
    null,
    undefined,
  ])("%j değerini site içi hedef saymaz", (value) => {
    expect(safeInternalPath(value)).toBeNull();
  });
});

describe("görsel adresi", () => {
  it("mutlak http ve https adresleri geçirir", () => {
    expect(safeImageUrl("https://cdn.example.test/a.png")).toBe("https://cdn.example.test/a.png");
    expect(safeImageUrl("http://cdn.example.test/a.png")).toBe("http://cdn.example.test/a.png");
  });

  it("aynı kökenden gelen göreli yolu geçirir", () => {
    // İki kapıyı ayıran şey bu satır: göreli yol hiçbir şema taşımıyor,
    // dolayısıyla tehlikeli olamaz, ve elemek çalışan görselleri kırardı.
    expect(safeImageUrl("/gorseller/kapak.png")).toBe("/gorseller/kapak.png");
  });

  it("tanımadığı şemayı ve ayrıştıramadığı değeri düşürür", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
    expect(safeImageUrl("cdn.example.test/a.png")).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
    expect(safeImageUrl("")).toBeNull();
  });
});

describe("bağlantı adresi", () => {
  it("mutlak http ve https adresleri geçirir", () => {
    expect(safeExternalUrl("https://cdn.example.test/cv.pdf")).toBe(
      "https://cdn.example.test/cv.pdf",
    );
    expect(safeExternalUrl("http://cdn.example.test/cv.pdf")).toBe(
      "http://cdn.example.test/cv.pdf",
    );
  });

  it("göreli yolu geçirmez", () => {
    // Görselden ayrıldığı yer. `href` tıklanabilir bir sink; buraya yalnız
    // backend'in mutlak adresi giriyor, göreli bağlantıyı `app-routes.ts`
    // yazar. Aynı değer görselde geçerli olurdu — kapıların ayrı durmasının
    // sebebi tam olarak bu.
    expect(safeExternalUrl("/gorseller/kapak.png")).toBeNull();
    expect(safeImageUrl("/gorseller/kapak.png")).not.toBeNull();
  });

  it("tıklamayla çalışan şemaları düşürür", () => {
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
  });
});
