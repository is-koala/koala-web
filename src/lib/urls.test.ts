import { describe, expect, it } from "vitest";

import { safeExternalUrl, safeImageUrl } from "./urls";

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
