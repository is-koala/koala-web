import { describe, expect, it, vi } from "vitest";

vi.mock("./cerez-politikasi/1.0.mdx", () => ({ default: () => null }));
vi.mock("./cerez-politikasi/1.1.mdx", () => ({ default: () => null }));
vi.mock("./gizlilik-politikasi/1.0.mdx", () => ({ default: () => null }));
vi.mock("./kullanim-kosullari/1.0.mdx", () => ({ default: () => null }));
vi.mock("./kvkk-aydinlatma/1.0.mdx", () => ({ default: () => null }));
vi.mock("./mesafeli-hizmet-sozlesmesi/1.0.mdx", () => ({
  default: () => null,
}));

import { getLegalDocumentVersion } from "./documents";

describe("yasal metin sürüm arşivi erişimi", () => {
  it("bilinmeyen slug için exception yerine yok sonucu verir", () => {
    expect(getLegalDocumentVersion("bilinmeyen-metin", "1.0")).toBeUndefined();
  });
});
