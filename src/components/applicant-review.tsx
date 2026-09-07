"use client";

import { useActionState, useMemo, useState } from "react";

import {
  applicantPage,
  applicantsInFilter,
  idleApplicantDossierState,
  idleConversationState,
  idleTalentPoolState,
  type ApplicantBadge,
  type ApplicantDossier,
  type ApplicantDossierAction,
  type ApplicantFilter,
  type ConversationAction,
  type JobApplicant,
  type TalentPoolAction,
} from "@/applications/employer-review";
import { ErrorState } from "@/components/states";
import { formatDateTime } from "@/lib/dates";
import { safeExternalUrl, safeImageUrl } from "@/lib/urls";
import { errorPresentation } from "@/lib/errors";

/**
 * Bir ilanın başvuru listesi ve aday paneli.
 *
 * Süzgeç ve sayfa **yerel durumda**, adres çubuğunda değil. İş arayanın
 * `/panel/basvurularim` ekranı bunları bağlantıya yazıyor çünkü orada uç
 * sayfalı ve her sayfa yeni bir istek. Burada uç sayfalı değil
 * (`JobsController.java:231`): liste bir kez iniyor ve dilimleme tarayıcıda
 * yapılıyor. Sayfayı adrese yazmak, her tıklamada 500 kaydı yeniden indirmek
 * olurdu.
 */
export function ApplicantReview({
  jobId,
  applicants,
  inTalentPool,
  dossierAction,
  talentPoolAction,
  conversationAction,
}: {
  jobId: string;
  applicants: readonly JobApplicant[];
  /** Sunucudan gelen ilk üyelik kümesi; eylem sonrası yerine yenisi geçer. */
  inTalentPool: readonly string[];
  dossierAction: ApplicantDossierAction;
  talentPoolAction: TalentPoolAction;
  conversationAction: ConversationAction;
}) {
  const [filter, setFilter] = useState<ApplicantFilter>("ALL");
  const [pageNumber, setPageNumber] = useState(0);
  const [dossierState, submitDossier, dossierPending] = useActionState(
    dossierAction,
    idleApplicantDossierState,
  );
  const [poolState, submitPool, poolPending] = useActionState(
    talentPoolAction,
    idleTalentPoolState,
  );
  const [conversationState, submitConversation, conversationPending] = useActionState(
    conversationAction,
    idleConversationState,
  );

  const filtered = useMemo(
    () => applicantsInFilter(applicants, filter),
    [applicants, filter],
  );
  const page = useMemo(() => applicantPage(filtered, pageNumber), [filtered, pageNumber]);
  const pooled = useMemo(
    () => new Set(poolState.status === "idle" ? inTalentPool : (poolState.workerIds ?? inTalentPool)),
    [inTalentPool, poolState],
  );

  return (
    <div className="application-list applicant-review">
      <nav className="application-filters" aria-label="Başvuru durumu">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-current={filter === option.value ? "true" : undefined}
            onClick={() => {
              setFilter(option.value);
              // Süzgeç daraldığında eski sayfa numarası kullanıcıyı listenin
              // dışında bırakırdı.
              setPageNumber(0);
            }}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {poolState.status === "error" ? (
        <p role="alert" className="form-warning">
          {talentPoolErrorMessage(poolState.errorCode, poolState.httpStatus)}
        </p>
      ) : null}

      {conversationState.status === "error" ? (
        <p role="alert" className="form-warning">
          {conversationErrorMessage(conversationState.errorCode, conversationState.httpStatus)}
        </p>
      ) : null}

      {page.items.length === 0 ? (
        <ApplicantEmpty filter={filter} />
      ) : (
        <div className="application-grid">
          {page.items.map((applicant) => (
            <ApplicantCard
              key={applicant.id}
              jobId={jobId}
              applicant={applicant}
              inPool={pooled.has(applicant.applicant.id)}
              dossier={
                dossierState.status === "done" &&
                dossierState.userId === applicant.applicant.id
                  ? dossierState.dossier
                  : null
              }
              dossierFailure={
                dossierState.status === "error" &&
                dossierState.userId === applicant.applicant.id
                  ? dossierState
                  : null
              }
              pending={{ dossier: dossierPending, pool: poolPending, conversation: conversationPending }}
              submitDossier={submitDossier}
              submitPool={submitPool}
              submitConversation={submitConversation}
            />
          ))}
        </div>
      )}

      {page.totalPages > 1 ? (
        <nav className="application-pagination" aria-label="Başvuru sayfaları">
          {page.first ? <span /> : (
            <button type="button" onClick={() => setPageNumber(page.page - 1)}>Önceki sayfa</button>
          )}
          <span>{`Sayfa ${page.page + 1} / ${page.totalPages}`}</span>
          {page.last ? <span /> : (
            <button type="button" onClick={() => setPageNumber(page.page + 1)}>Sonraki sayfa</button>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function ApplicantCard({
  jobId,
  applicant,
  inPool,
  dossier,
  dossierFailure,
  pending,
  submitDossier,
  submitPool,
  submitConversation,
}: {
  jobId: string;
  applicant: JobApplicant;
  inPool: boolean;
  dossier: ApplicantDossier | null;
  dossierFailure: { errorCode: string; httpStatus: number } | null;
  pending: { dossier: boolean; pool: boolean; conversation: boolean };
  submitDossier: (formData: FormData) => void;
  submitPool: (formData: FormData) => void;
  submitConversation: (formData: FormData) => void;
}) {
  const titleId = `applicant-${applicant.id}`;
  const workerId = applicant.applicant.id;
  const cvUrl = safeExternalUrl(applicant.cvUrl);

  return (
    <article className="application-card applicant-card" aria-labelledby={titleId}>
      <div className="application-card-body">
        <span className={`application-status application-status-${applicant.status.toLowerCase()}`}>
          {decisionLabel[applicant.status]}
        </span>
        <div className="applicant-identity">
          <ApplicantAvatar applicant={applicant} />
          <h2 id={titleId}>{applicant.applicant.fullName || "Adı paylaşılmadı"}</h2>
        </div>
        <dl className="application-facts">
          {applicant.occupation ? (
            <div><dt>Mesleği</dt><dd>{applicant.occupation}</dd></div>
          ) : null}
          <div><dt>Başvuru tarihi</dt><dd>{formatDateTime(applicant.appliedAt)}</dd></div>
        </dl>

        {applicant.notes ? (
          <div className="application-note">
            <h3>Başvuru notu</h3>
            <p>{applicant.notes}</p>
          </div>
        ) : null}

        <div className="applicant-actions">
          {cvUrl ? (
            <a
              className="button button-secondary button-small"
              href={cvUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Özgeçmişi aç
            </a>
          ) : null}

          <form action={submitDossier}>
            <input type="hidden" name="userId" value={workerId} />
            <button className="button button-secondary button-small" disabled={pending.dossier}>
              {dossier ? "Aday bilgilerini yenile" : "Adayı incele"}
            </button>
          </form>

          <form action={submitPool}>
            <input type="hidden" name="workerId" value={workerId} />
            <input type="hidden" name="operation" value={inPool ? "remove" : "add"} />
            <button className="button button-secondary button-small" disabled={pending.pool}>
              {inPool ? "Havuzdan çıkar" : "Yetenek havuzuna ekle"}
            </button>
          </form>

          <form action={submitConversation}>
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="workerId" value={workerId} />
            <button className="button button-secondary button-small" disabled={pending.conversation}>
              Mesaj gönder
            </button>
          </form>
        </div>

        {dossierFailure ? (
          <ErrorState errorCode={dossierFailure.errorCode} status={dossierFailure.httpStatus} />
        ) : null}
        {dossier ? <ApplicantDossierPanel dossier={dossier} /> : null}
      </div>
    </article>
  );
}

function ApplicantAvatar({ applicant }: { applicant: JobApplicant }) {
  const url = safeImageUrl(applicant.applicant.profilePictureUrl);
  if (!url) {
    return <span className="applicant-avatar applicant-avatar-empty" aria-hidden="true" />;
  }
  return (
    <span
      className="applicant-avatar"
      role="img"
      aria-label={`${applicant.applicant.fullName} profil fotoğrafı`}
      style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
    />
  );
}

function ApplicantDossierPanel({ dossier }: { dossier: ApplicantDossier }) {
  return (
    <section className="applicant-dossier" aria-label="Aday ayrıntısı">
      <h3>Aday bilgileri</h3>
      <dl className="application-facts">
        {dossier.profile.occupation ? (
          <div><dt>Mesleği</dt><dd>{dossier.profile.occupation}</dd></div>
        ) : null}
        {dossier.profile.cityName || dossier.profile.districtName ? (
          <div>
            <dt>Konum</dt>
            <dd>{[dossier.profile.districtName, dossier.profile.cityName].filter(Boolean).join(", ")}</dd>
          </div>
        ) : null}
        <div>
          <dt>Puan özeti</dt>
          <dd>
            {dossier.ratingSummary && dossier.ratingSummary.reviewCount > 0
              ? `${dossier.ratingSummary.averageRating} / 5 · ${dossier.ratingSummary.reviewCount} değerlendirme`
              : "Henüz değerlendirilmemiş"}
          </dd>
        </div>
      </dl>

      {dossier.profile.about ? <p className="applicant-about">{dossier.profile.about}</p> : null}

      <ApplicantBadges badges={dossier.badges} />

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
  );
}

/**
 * Adayın kazandığı rozetler.
 *
 * Boş durum yazılı: rozet listesinin hiç çizilmemesi ile adayın rozetinin
 * olmaması ekranda aynı görünürdü ve işveren "rozetler nerede" diye arardı.
 */
function ApplicantBadges({ badges }: { badges: readonly ApplicantBadge[] }) {
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

function ApplicantEmpty({ filter }: { filter: ApplicantFilter }) {
  return (
    <div role="status" className="state-card">
      <h2>{filter === "ALL" ? "Henüz başvuru yok" : "Bu süzgeçte başvuru yok"}</h2>
      <p>
        {filter === "ALL"
          ? "İlanına gelen başvurular burada listelenecek."
          : "Başka bir durum seçerek listedeki adayları görebilirsin."}
      </p>
    </div>
  );
}

/**
 * Havuz reddi.
 *
 * `TALENT_CANNOT_ADD_SELF` aile metnine ("Gönderdiğin bilgilerden bazıları
 * geçerli değil") düşseydi kullanıcı düzeltilecek bir alan arardı; burada
 * düzeltilecek bir şey yok.
 */
function talentPoolErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "TALENT_CANNOT_ADD_SELF") return "Kendini yetenek havuzuna ekleyemezsin.";
  if (errorCode === "VALIDATION_FAILED") return "Bu işlem gönderilemedi; sayfayı yenileyip yeniden dene.";
  return errorPresentation(errorCode, httpStatus).message;
}

/**
 * Konuşma açma reddi.
 *
 * Üçü de `errorCode` ile ayrışıyor ve üçünde de kullanıcının yapacağı iş
 * farklı: ilki geçici değil kalıcı bir kural, ikincisi karşı tarafın kararı,
 * üçüncüsü zaman aşımı.
 */
function conversationErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "MESSAGING_NO_RELATIONSHIP_WITH_JOB") {
    return "Bu adayla yalnız kendi ilanına başvurduğu için yazışabilirsin.";
  }
  if (errorCode === "MESSAGING_BLOCKED") {
    return "Bu adayla mesajlaşma kapalı.";
  }
  if (errorCode === "MESSAGING_WINDOW_CLOSED") {
    return "Bu ilanın mesajlaşma süresi doldu.";
  }
  return errorPresentation(errorCode, httpStatus).message;
}

/**
 * Rozet seviyesinin Türkçesi.
 *
 * `NONE` ve `UNKNOWN` boş: ilki seviyesi olmayan bir rozet ailesi
 * (`BadgeTier.NONE`), ikincisi backend'in tanımadığımız bir seviye
 * göndermesi. İkisinde de rozet adı tek başına doğru; uydurulmuş bir seviye
 * yazmak yanlış olurdu.
 */
const badgeTierLabel: Readonly<Record<ApplicantBadge["tier"], string>> = {
  BRONZE: "Bronz",
  SILVER: "Gümüş",
  GOLD: "Altın",
  NONE: "",
  UNKNOWN: "",
};

const filterOptions: ReadonlyArray<{ value: ApplicantFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "APPLIED", label: "Bekleyenler" },
  { value: "ACCEPTED", label: "Kabul edilenler" },
  { value: "REJECTED", label: "Reddedilenler" },
  { value: "WITHDRAWN", label: "Geri çekilenler" },
];

/** Karar metinleri işverenin bakış açısıyla yazılı; iş arayanınkiyle aynı değil. */
const decisionLabel: Readonly<Record<JobApplicant["status"], string>> = {
  APPLIED: "Karar bekliyor",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Aday başvurusunu geri çekti",
  UNKNOWN: "Durum güncelleniyor",
};
