import { ratingStars, reviewSummary, type AssignmentReview } from "@/assignments/review";
import { formatDateTime } from "@/lib/dates";

/**
 * Yazarın kendi değerlendirmesi: "Değerlendirmeniz: ★4 · Dakikti" + an.
 *
 * İki kabuk da aynı kutuyu çiziyor; ayrıldıkları yer hitap (`address`,
 * çalışan paneli "sen" der) ve `live`: yalnız az önce gönderilen
 * değerlendirme `role="status"` ile ekran okuyucuya duyurulur, sayfayla
 * gelen mevcut değerlendirme duyuru değil içeriktir. `createdAt` yoksa (boş
 * POST zarfı, eski sunucu) zaman satırı çizilmez, an uydurulmaz.
 */
export function ReviewSummary({
  review,
  address = "formal",
  live = false,
}: {
  review: AssignmentReview;
  address?: "formal" | "informal";
  live?: boolean;
}) {
  return (
    <p
      role={live ? "status" : undefined}
      className="assignment-review-summary"
      data-testid="assignment-review-summary"
    >
      <span aria-hidden="true" className="assignment-review-stars">{ratingStars(review.rating)}</span>
      <span>{reviewSummary(review, address)}</span>
      {review.createdAt ? (
        <time dateTime={review.createdAt}>{formatDateTime(review.createdAt)}</time>
      ) : null}
    </p>
  );
}
