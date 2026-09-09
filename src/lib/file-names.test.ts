import { describe, expect, it } from "vitest";

import { safeDownloadFileName } from "./file-names";

describe("güvenli indirme dosya adı", () => {
  it("yol, kontrol ve çift yönlü metin işaretlerini istemci dosya adından çıkarır", () => {
    expect(safeDownloadFileName("../\u202Egnp.exe/kanıt\u0000.pdf")).toBe(
      "_gnp.exe_kanıt .pdf",
    );
  });

  it("Unicode kod noktasını bölmeden sınırlar ve boş adı yedeğe düşürür", () => {
    const safe = safeDownloadFileName(`${"😀".repeat(200)}.pdf`);
    expect(Array.from(safe)).toHaveLength(180);
    expect(safe).toMatch(/\.pdf$/);
    expect(safeDownloadFileName("\u202E\u0000")).toBe("kanit");
  });
});
