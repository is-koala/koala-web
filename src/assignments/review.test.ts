import { describe, expect, it } from "vitest";

import {
  canReviewAssignment,
  parseReviewRating,
  ratingStars,
  reviewSummary,
  showsReviewSection,
} from "./review";

describe("atama değerlendirme modeli", () => {
  it("yalnız COMPLETED atama değerlendirilir", () => {
    expect(canReviewAssignment("COMPLETED", null)).toBe(true);
    for (const status of ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "REJECTED", "CANCELLED", "UNKNOWN"] as const) {
      expect(canReviewAssignment(status, null)).toBe(false);
    }
  });

  it("satır zaten yazarın değerlendirmesini taşıyorsa form açılmaz; eski sunucunun null'u formu kapatmaz", () => {
    const review = { rating: 4, comment: "Dakikti", createdAt: "2026-09-14T10:00:00Z" };
    expect(canReviewAssignment("COMPLETED", review)).toBe(false);
    expect(canReviewAssignment("COMPLETED", null)).toBe(true);
    expect(canReviewAssignment("IN_PROGRESS", review)).toBe(false);
  });

  it("bölüm form açılabiliyorsa ya da gösterilecek değerlendirme varsa çizilir", () => {
    const review = { rating: 4, comment: null, createdAt: null };
    expect(showsReviewSection("COMPLETED", null)).toBe(true);
    expect(showsReviewSection("COMPLETED", review)).toBe(true);
    expect(showsReviewSection("IN_PROGRESS", null)).toBe(false);
  });

  it("form değerini 1–5 tam sayıya indirger, geri kalanı reddeder", () => {
    expect(parseReviewRating("4")).toBe(4);
    expect(parseReviewRating(5)).toBe(5);
    expect(parseReviewRating("0")).toBeNull();
    expect(parseReviewRating("6")).toBeNull();
    expect(parseReviewRating("2.5")).toBeNull();
    expect(parseReviewRating("")).toBeNull();
    expect(parseReviewRating("abc")).toBeNull();
    expect(parseReviewRating(null)).toBeNull();
    expect(parseReviewRating(undefined)).toBeNull();
  });

  it("özet metnini yorumlu ve yorumsuz kurar, yıldız dizisini beşe tamamlar", () => {
    expect(reviewSummary({ rating: 4, comment: "Dakikti" })).toBe("Değerlendirmeniz: ★4 · Dakikti");
    expect(reviewSummary({ rating: 5, comment: null })).toBe("Değerlendirmeniz: ★5");
    // Çalışan paneli "sen" diyor; özet ekranın tonunu izler.
    expect(reviewSummary({ rating: 3, comment: "İyiydi" }, "informal")).toBe("Değerlendirmen: ★3 · İyiydi");
    expect(reviewSummary({ rating: 5, comment: null }, "informal")).toBe("Değerlendirmen: ★5");
    expect(ratingStars(4)).toBe("★★★★☆");
    expect(ratingStars(0)).toBe("☆☆☆☆☆");
    expect(ratingStars(9)).toBe("★★★★★");
  });
});
