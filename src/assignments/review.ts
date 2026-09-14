import type { AssignmentStatus } from "@/assignments/contract";

/**
 * Atama değerlendirmesi — iki kabuğun paylaştığı model.
 *
 * `server-only` yok: sunucu action'ı formu doğrularken, istemci bileşeni
 * yıldızları çizerken aynı sınırları okuyor. Sınırlar backend'in
 * `CreateReviewDto`'sundan: puan `@Min(1) @Max(5)`, yorum `@Size(max = 2000)`.
 * İki kabuk da (`/panel/is`, `/isveren/atama`) aynı uca yazıyor ve yazar kim
 * ise karşı taraf konu oluyor; bu yüzden sabitler burada tek yerde.
 */

/** `CreateReviewDto.comment` — `@Size(max = 2000)`. */
export const reviewCommentMaxLength = 2000;

export const reviewRatings = [1, 2, 3, 4, 5] as const;

export type ReviewRating = (typeof reviewRatings)[number];

/** Yazarın kendi bıraktığı değerlendirme; ekranda "Değerlendirmeniz" olarak çizilir. */
export type AssignmentReview = {
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string | null;
};

/**
 * "İşçiyi değerlendir" formunun action durumu.
 *
 * `done` yeni yazılan değerlendirmeyi taşıyor: atama satırı bugün yazarın
 * değerlendirmesini döndürmüyor (`MyAssignmentDto`'da `reviews[]` yok), o
 * yüzden ekran onu sunucudan yeniden okuyamaz, POST yanıtından alır.
 * `reviewed` ise backend'in 409 `REVIEW_ALREADY_REVIEWED` reddi: içerik
 * bilinmiyor ama form kapanır — kullanıcı zaten değerlendirmiş.
 */
export type ReviewActionState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly review: AssignmentReview }
  | { readonly status: "reviewed" }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleReviewActionState: ReviewActionState = { status: "idle" };

export type ReviewAction = (
  state: ReviewActionState,
  formData: FormData,
) => Promise<ReviewActionState>;

/** Backend `ReviewManager.leaveReview`: yalnız `COMPLETED` atama değerlendirilir. */
export function canReviewAssignment(status: AssignmentStatus): boolean {
  return status === "COMPLETED";
}

/** Form alanından gelen puanı 1–5 tam sayıya indirger; başka her şey `null`. */
export function parseReviewRating(value: unknown): ReviewRating | null {
  const rating = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof rating === "number" && (reviewRatings as readonly number[]).includes(rating)
    ? (rating as ReviewRating)
    : null;
}

/** "★★★★☆" — yıldız sayısı ekran okuyucuya ayrıca metinle söyleniyor. */
export function ratingStars(rating: number): string {
  const filled = Math.min(Math.max(Math.round(rating), 0), reviewRatings.length);
  return "★".repeat(filled) + "☆".repeat(reviewRatings.length - filled);
}

/** "Değerlendirmeniz: ★4 · Dakikti" — yorum yoksa yalnız puan. */
export function reviewSummary(review: AssignmentReview): string {
  const head = `Değerlendirmeniz: ★${review.rating}`;
  return review.comment ? `${head} · ${review.comment}` : head;
}
