import {
  badgeTierLabel,
  ratingSummaryLabel,
  type ApplicantBadge,
  type ApplicantDossier,
} from "@/applications/employer-review";
import { Avatar, FactList } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { safeExternalUrl } from "@/lib/urls";

/**
 * Aday dosyası: profil, puan özeti, rozetler ve son değerlendirmeler.
 *
 * Sunucu bileşeni; `/isveren/aday/{userId}` sayfası çiziyor. Başvuru
 * kartındaki panel (`applicant-review.tsx`) aynı modeli bir action ile
 * kartın altına çiziyor — ikisi `ApplicantDossier`'i ve rozet sözlüğünü
 * paylaşıyor, farkları nerede durdukları. Bu sayfa kartı olmayan yerlerin
 * bağlantısı: atamanın işçi kartı ve yetenek havuzu satırı.
 *
 * Özgeçmiş `safeExternalUrl` kapısından geçiyor; `rel="noopener noreferrer"`
 * açılan sayfanın bu sekmeye erişimini kapatıyor, adresi değil.
 */
export function ApplicantDossierView({ dossier }: { dossier: ApplicantDossier }) {
  const { profile } = dossier;
  const location = [profile.districtName, profile.cityName].filter(Boolean).join(", ");
  const rating = ratingSummaryLabel(dossier.ratingSummary);
  const cvUrl = safeExternalUrl(profile.cvUrl);

  return (
    <div className="applicant-dossier-page">
      <section className="work-employer applicant-dossier-identity" aria-label="Aday">
        <Avatar name={profile.fullName || "?"} src={profile.profilePictureUrl} size="lg" />
        <div className="work-employer-copy">
          <span className="muted">Aday</span>
          <strong>{profile.fullName || "Adı paylaşılmadı"}</strong>
          {profile.occupation ? <span>{profile.occupation}</span> : null}
        </div>
      </section>

      <FactList
        columns={3}
        facts={[
          location ? { term: "Konum", detail: location } : null,
          { term: "Puan özeti", detail: rating ?? "Henüz değerlendirilmemiş" },
          cvUrl
            ? {
                term: "Özgeçmiş",
                detail: (
                  <a className="text-link" href={cvUrl} target="_blank" rel="noopener noreferrer">
                    Özgeçmişi aç
                  </a>
                ),
              }
            : null,
        ]}
      />

      {profile.about ? (
        <section className="work-detail-section" aria-labelledby="applicant-about-title">
          <h2 id="applicant-about-title">Hakkında</h2>
          <p className="applicant-about">{profile.about}</p>
        </section>
      ) : null}

      <section className="work-detail-section" aria-labelledby="applicant-badges-title">
        <h2 id="applicant-badges-title">Rozetler</h2>
        <ApplicantBadgeList badges={dossier.badges} />
      </section>

      <section className="work-detail-section" aria-labelledby="applicant-reviews-title">
        <h2 id="applicant-reviews-title">Son değerlendirmeler</h2>
        {dossier.reviews.length > 0 ? (
          <ol className="applicant-reviews" aria-label="Son değerlendirmeler">
            {dossier.reviews.map((review) => (
              <li key={review.id}>
                <div className="applicant-review-heading">
                  <strong>{review.authorName ?? "Anonim"}</strong>
                  <span>{review.rating} / 5</span>
                </div>
                {review.comment ? <p>{review.comment}</p> : null}
                <time dateTime={review.createdAt}>{formatDateTime(review.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Bu adaya henüz değerlendirme yazılmamış.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Adayın kazandığı rozetler.
 *
 * Boş durum yazılı: rozet listesinin hiç çizilmemesi ile adayın rozetinin
 * olmaması ekranda aynı görünürdü ve işveren "rozetler nerede" diye arardı.
 */
function ApplicantBadgeList({ badges }: { badges: readonly ApplicantBadge[] }) {
  if (badges.length === 0) {
    return <p className="muted">Bu aday henüz rozet kazanmamış.</p>;
  }

  return (
    <ul className="applicant-badges" aria-label="Rozetler">
      {badges.map((badge) => (
        <li key={badge.code} data-tier={badge.tier.toLowerCase()}>
          <strong>{badge.name}</strong>
          {badgeTierLabel[badge.tier] ? <span>{badgeTierLabel[badge.tier]}</span> : null}
        </li>
      ))}
    </ul>
  );
}
