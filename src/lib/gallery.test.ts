import { describe, expect, it } from "vitest";

import {
  galleryCaptionLimit,
  galleryClientLimit,
  galleryListFromJson,
  galleryPutBody,
  galleryPutRejectionMessage,
  galleryQuotaReason,
  precheckGalleryUpload,
  remainingSlotsAfterLimit,
  remainingSlotsBeforeLimit,
  type GalleryImage,
} from "./gallery";

const first = image("11111111-1111-4111-8111-111111111111", { cover: true, sortOrder: 0 });
const second = image("22222222-2222-4222-8222-222222222222", { cover: false, sortOrder: 1 });

describe("galeri PUT gövdesi", () => {
  it("ekrandaki listenin tamamını, yalnız DTO alanlarıyla gönderir", () => {
    const result = galleryPutBody([first, second]);

    expect(result).toEqual({
      ok: true,
      body: {
        images: [
          {
            imageId: first.id,
            sortOrder: 0,
            cover: true,
            caption: "Mutfak",
          },
          {
            imageId: second.id,
            sortOrder: 1,
            cover: false,
            caption: null,
          },
        ],
      },
    });
    expect(result.ok && Object.keys(result.body.images[0]).sort()).toEqual([
      "caption",
      "cover",
      "imageId",
      "sortOrder",
    ]);
  });

  it("aynı görseli iki kez listelendiğinde ağa hiç gitmez", () => {
    expect(galleryPutBody([first, { ...second, id: first.id }])).toEqual({
      ok: false,
      reason: "duplicateImageId",
    });
  });

  it("birden fazla kapak seçildiğinde ağa hiç gitmez", () => {
    expect(galleryPutBody([first, { ...second, cover: true }])).toEqual({
      ok: false,
      reason: "multipleCovers",
    });
  });

  it("sıra numarasını listedeki konuma yazar, çağıranın bayat sortOrder'ına değil", () => {
    const result = galleryPutBody([
      { ...second, sortOrder: 7 },
      { ...first, cover: false, sortOrder: 0 },
    ]);

    expect(result.ok && result.body.images.map((entry) => entry.imageId)).toEqual([
      second.id,
      first.id,
    ]);
    expect(result.ok && result.body.images.map((entry) => entry.sortOrder)).toEqual([0, 1]);
  });

  it("255 karakteri aşan açıklamayı ağa hiç göndermez", () => {
    expect(
      galleryPutBody([{ ...first, caption: "a".repeat(galleryCaptionLimit + 1) }]),
    ).toEqual({ ok: false, reason: "captionTooLong" });
  });

  it("red gerekçelerini sunucuya gitmeden Türkçe söyler", () => {
    expect(galleryPutRejectionMessage("duplicateImageId")).toBe(
      "Aynı görsel galeride bir kez yer alabilir.",
    );
    expect(galleryPutRejectionMessage("multipleCovers")).toBe(
      "Aynı anda yalnız bir kapak seçilebilir.",
    );
  });
});

describe("action'ın tam listesi", () => {
  it("ekrandaki modeli Image.id ile okur", () => {
    expect(galleryListFromJson(JSON.stringify([first, second]))).toEqual([first, second]);
  });

  it("bozuk kimliği backend'e hiç taşımaz", () => {
    expect(galleryListFromJson(JSON.stringify([{ ...first, id: "not-a-uuid" }]))).toBeNull();
    expect(galleryListFromJson("{")).toBeNull();
  });
});

describe("yükleme ön kontrolü", () => {
  it("desteklenmeyen türü sunucuya hiç göndermez", () => {
    const file = new File(["<svg/>"], "zararli.svg", { type: "image/svg+xml" });

    expect(precheckGalleryUpload(file, 4)).toEqual({
      ok: false,
      reason: "PNG, JPG, JPEG veya WEBP biçiminde bir görsel seç.",
    });
  });

  it("10 MB üzeri dosyayı sunucuya hiç göndermez", () => {
    const file = new File(["x"], "buyuk.webp", { type: "image/webp" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });

    expect(precheckGalleryUpload(file, 4)).toEqual({
      ok: false,
      reason: "Görsel en fazla 10 MB olabilir.",
    });
  });

  it("kota yokken dosyayı sunucuya hiç göndermez", () => {
    const file = new File(["koala"], "mekan.webp", { type: "image/webp" });

    expect(precheckGalleryUpload(file, 0)).toEqual({
      ok: false,
      reason: galleryQuotaReason,
    });
  });

  it("kabul edilen görseli geçirir", () => {
    const file = new File(["koala"], "mekan.JPEG", { type: "image/jpeg" });

    expect(precheckGalleryUpload(file, 1)).toEqual({ ok: true });
  });

  it("boş dosyayı sunucuya hiç göndermez", () => {
    const file = new File([], "bos.webp", { type: "image/webp" });

    expect(precheckGalleryUpload(file, 1)).toEqual({
      ok: false,
      reason: "Boş bir dosya yüklenemez. İçeriği olan bir görsel seç.",
    });
  });
});

describe("galeri kotası", () => {
  it("409 öncesi kalan yeri istemci tavanından okur", () => {
    expect(remainingSlotsBeforeLimit(0)).toBe(galleryClientLimit);
    expect(remainingSlotsBeforeLimit(galleryClientLimit)).toBe(0);
    expect(remainingSlotsBeforeLimit(3)).toBe(7);
  });

  it("409 sonrası kalan yeri GET uzunluğundan okur, sabit 10'dan değil", () => {
    expect(remainingSlotsAfterLimit(8, 8)).toBe(0);
    expect(remainingSlotsAfterLimit(7, 8)).toBe(1);
    expect(remainingSlotsAfterLimit(8, 5)).toBe(0);
  });

  it("açıklama sınırını DTO ile aynı tutar", () => {
    expect(galleryCaptionLimit).toBe(255);
  });
});

function image(id: string, overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id,
    url: `https://cdn.example.test/${id}.webp`,
    caption: id.startsWith("1111") ? "Mutfak" : null,
    cover: false,
    sortOrder: 0,
    ...overrides,
  };
}
