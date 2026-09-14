import { describe, expect, it } from "vitest";

import {
  canReviewAssignment,
  parseReviewRating,
  ratingStars,
  reviewSummary,
} from "./review";

describe("atama değerlendirme modeli", () => {
  it("yalnız COMPLETED atama değerlendirilir", () => {
    expect(canReviewAssignment("COMPLETED")).toBe(true);
    for (const status of ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "REJECTED", "CANCELLED", "UNKNOWN"] as const) {
      expect(canReviewAssignment(status)).toBe(false);
    }
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
    expect(ratingStars(4)).toBe("★★★★☆");
    expect(ratingStars(0)).toBe("☆☆☆☆☆");
    expect(ratingStars(9)).toBe("★★★★★");
  });
});
