"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  applicantPage,
  applicantsInFilter,
  applicationDecisionGate,
  idleApplicantDossierState,
  idleApplicationDecisionState,
  idleConversationState,
  idleTalentPoolState,
  rejectionReasonMaxLength,
  type ApplicantBadge,
  type ApplicantDossier,
  type ApplicantDossierAction,
  type ApplicantFilter,
  type ApplicationDecisionAction,
  type ApplicationDecisionOutcome,
  type ApplicationDecisionState,
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
  headcountFull,
  dossierAction,
  talentPoolAction,
  conversationAction,
  decisionAction,
}: {
  jobId: string;
  applicants: readonly JobApplicant[];
  /** Sunucudan gelen ilk üyelik kümesi; eylem sonrası yerine yenisi geçer. */
  inTalentPool: readonly string[];
  /**
   * İlanın kontenjanı doldu mu.
   *
   * Kabul düğmesinin kapısı: sunucu dolu ilanda kabulü 409
   * (`JOB_APPLICATION_JOB_HEADCOUNT_FULL`) ile reddediyor ve istemci bunu
   * önden göstermezse kullanıcı geri alınamaz sandığı bir düğmeye basıp
   * hatayla karşılaşır.
   */
  headcountFull: boolean;
  dossierAction: ApplicantDossierAction;
  talentPoolAction: TalentPoolAction;
  conversationAction: ConversationAction;
  decisionAction: ApplicationDecisionAction;
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
  const [decisionState, submitDecision, decisionPending] = useActionState(
    decisionAction,
    idleApplicationDecisionState,
  );
  const [acceptance, setAcceptance] = useState<JobApplicant | null>(null);
  const decided = useDecidedApplications(decisionState);

  const filtered = useMemo(
    () => applicantsInFilter(applicants, filter),
    [applicants, filter],
  );
  const page = useMemo(() => applicantPage(filtered, pageNumber), [filtered, pageNumber]);
  const pooled = useMemo(
    () => new Set(poolState.status === "idle" ? inTalentPool : (poolState.workerIds ?? inTalentPool)),
    [inTalentPool, poolState],
  );
  /*
    Kimliği listede olmayan bir karar reddi.

    Kart eşleşmediğinde uyarı kartın içine çizilemez ve sessizce kaybolurdu;
    biçimi bozuk bir gövde (`applicationId: ""`) tam olarak bu hâle düşüyor.
  */
  const orphanFailure =
    decisionState.status === "error" &&
    !applicants.some((applicant) => applicant.id === decisionState.applicationId)
      ? decisionState
      : null;

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

      {orphanFailure ? (
        <p role="alert" className="form-warning">
          {decisionErrorMessage(orphanFailure.errorCode, orphanFailure.httpStatus)}
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
              headcountFull={headcountFull}
              decidedNow={decided.get(applicant.id) ?? null}
              decisionFailure={
                decisionState.status === "error" &&
                decisionState.applicationId === applicant.id
                  ? decisionState
                  : null
              }
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
              pending={{
                dossier: dossierPending,
                pool: poolPending,
                conversation: conversationPending,
                decision: decisionPending,
              }}
              submitDossier={submitDossier}
              submitPool={submitPool}
              submitConversation={submitConversation}
              submitDecision={submitDecision}
              onAcceptRequested={() => setAcceptance(applicant)}
            />
          ))}
        </div>
      )}

      {acceptance ? (
        <AcceptanceDialog
          jobId={jobId}
          applicant={acceptance}
          pending={decisionPending}
          submitDecision={submitDecision}
          onClose={() => setAcceptance(null)}
        />
      ) : null}

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

/**
 * Bu oturumda verilmiş kararlar.
 *
 * `useActionState` tek bir durum taşıyor: ikinci bir karta karar verildiğinde
 * ilkinin cevabı üzerine yazılırdı ve o kart — sunucu listesi tazelenene kadar
 * hâlâ `APPLIED` görünüyor — yeniden karara açılırdı. Kararlar bu yüzden
 * birikiyor.
 *
 * Güncelleme render sırasında yapılıyor (React'in "props değiştiğinde durumu
 * ayarla" kalıbı): bir `useEffect` ile yazmak kilidi bir çerçeve geciktirir ve
 * o aralıkta kart tıklanabilir kalırdı.
 */
function useDecidedApplications(
  state: ApplicationDecisionState,
): ReadonlyMap<string, ApplicationDecisionOutcome> {
  const [decided, setDecided] = useState<ReadonlyMap<string, ApplicationDecisionOutcome>>(
    () => new Map(),
  );
  const [seen, setSeen] = useState<ApplicationDecisionState>(state);

  if (seen !== state) {
    setSeen(state);
    if (state.status === "done" && decided.get(state.applicationId) !== state.outcome) {
      setDecided(new Map(decided).set(state.applicationId, state.outcome));
    }
  }

  return decided;
}

function ApplicantCard({
  jobId,
  applicant,
  inPool,
  headcountFull,
  decidedNow,
  decisionFailure,
  dossier,
  dossierFailure,
  pending,
  submitDossier,
  submitPool,
  submitConversation,
  submitDecision,
  onAcceptRequested,
}: {
  jobId: string;
  applicant: JobApplicant;
  inPool: boolean;
  headcountFull: boolean;
  /** Bu oturumda verilmiş karar; sunucu listesi henüz tazelenmemiş olabilir. */
  decidedNow: ApplicationDecisionOutcome | null;
  decisionFailure: { errorCode: string; httpStatus: number } | null;
  dossier: ApplicantDossier | null;
  dossierFailure: { errorCode: string; httpStatus: number } | null;
  pending: { dossier: boolean; pool: boolean; conversation: boolean; decision: boolean };
  submitDossier: (formData: FormData) => void;
  submitPool: (formData: FormData) => void;
  submitConversation: (formData: FormData) => void;
  submitDecision: (formData: FormData) => void;
  onAcceptRequested: () => void;
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

        <ApplicantDecision
          jobId={jobId}
          applicant={applicant}
          headcountFull={headcountFull}
          decidedNow={decidedNow}
          failure={decisionFailure}
          pending={pending.decision}
          submitDecision={submitDecision}
          onAcceptRequested={onAcceptRequested}
        />

        {dossierFailure ? (
          <ErrorState errorCode={dossierFailure.errorCode} status={dossierFailure.httpStatus} />
        ) : null}
        {dossier ? <ApplicantDossierPanel dossier={dossier} /> : null}
      </div>
    </article>
  );
}

/**
 * Kartın karar bölümü.
 *
 * Kapalı hâl **gizlenmiyor**: kapının kapalı olduğu her durumda nedeni yazılı
 * duruyor. Düğmeyi kaldırıp sebebi yazmamak, kullanıcıyı "kabul düğmesi
 * nerede" diye aramaya bırakırdı — kabul kontenjan dolduğunda kayboluyor ve
 * ilan hâlâ açık görünüyor.
 */
function ApplicantDecision({
  jobId,
  applicant,
  headcountFull,
  decidedNow,
  failure,
  pending,
  submitDecision,
  onAcceptRequested,
}: {
  jobId: string;
  applicant: JobApplicant;
  headcountFull: boolean;
  decidedNow: ApplicationDecisionOutcome | null;
  failure: { errorCode: string; httpStatus: number } | null;
  pending: boolean;
  submitDecision: (formData: FormData) => void;
  onAcceptRequested: () => void;
}) {
  const gate = applicationDecisionGate({
    status: applicant.status,
    headcountFull,
    decidedNow: decidedNow !== null,
  });
  const reasonId = `applicant-rejection-${applicant.id}`;

  return (
    <section className="applicant-decision" aria-label="Başvuru kararı">
      {failure ? (
        <p role="alert" className="form-warning">
          {decisionErrorMessage(failure.errorCode, failure.httpStatus)}
        </p>
      ) : null}

      {decidedNow ? (
        <p role="status" className="applicant-decision-done">
          {decidedNow.decision === "ACCEPTED"
            ? "Başvuru kabul edildi. Adaya teklif gitti ve tam iş adresi ona açıldı."
            : "Başvuru reddedildi. Yazdığın gerekçe adayın başvuru ekranında görünecek."}
        </p>
      ) : null}

      {/*
        Atama görünümüne geçiş (#37). Kimlik yalnız kabul **yanıtında** var:
        başvuru listesi ucu (`JobApplicantDto`) atama taşımıyor, yani daha önce
        kabul edilmiş bir kartta kimlik elde yok ve bağlantı atama listesine
        gidiyor. İkisinin arasını kapatmak için ikinci bir uç yok.
      */}
      {decidedNow?.decision === "ACCEPTED" ? (
        <Link
          className="button button-secondary button-small"
          href={
            decidedNow.assignmentId
              ? `/isveren/atama/${encodeURIComponent(decidedNow.assignmentId)}`
              : "/isveren/atamalar"
          }
        >
          Atamayı aç
        </Link>
      ) : null}

      {gate.closedReason ? (
        <p className="muted">{gate.closedReason}</p>
      ) : (
        <>
          <div className="applicant-decision-actions">
            <button
              className="button button-primary button-small"
              type="button"
              onClick={onAcceptRequested}
              disabled={!gate.canAccept || pending}
            >
              Kabul et
            </button>
          </div>
          {gate.acceptClosedReason ? <p className="muted">{gate.acceptClosedReason}</p> : null}

          <details className="applicant-decision-reject">
            <summary>Başvuruyu reddet</summary>
            <form className="form compact-form" action={submitDecision}>
              <input type="hidden" name="applicationId" value={applicant.id} />
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="decision" value="REJECTED" />
              <div className="field">
                <label htmlFor={reasonId}>Red gerekçesi</label>
                <textarea
                  id={reasonId}
                  name="rejectionReason"
                  required
                  rows={3}
                  maxLength={rejectionReasonMaxLength}
                />
                <p className="field-hint">
                  Aday bu açıklamayı başvuru ekranında okuyacak. Red kararı da geri alınamıyor.
                </p>
              </div>
              <button className="button button-danger button-small" disabled={pending}>
                Reddi gönder
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}

/**
 * Kabulün son kontrolü.
 *
 * Üç sonucu da **karar anında** yazıyor, çünkü üçü de geri alınamaz ve
 * ikisinin bedeli sonradan öğrenilemez: ADR-0003 uyarınca atama kurulduğu an
 * tam iş adresi çalışana açılıyor (`ApplicationDecisionIT`
 * `addressPrecision: EXACT`, sokak, bina numarası ve koordinat), ilanın
 * kontenjanından bir yer tükeniyor, ve sunucu ikinci karara 409 veriyor.
 * Adresi sonradan öğrenmek, geri alınamaz bir ifşayı öğrenmek demek.
 */
function AcceptanceDialog({
  jobId,
  applicant,
  pending,
  submitDecision,
  onClose,
}: {
  jobId: string;
  applicant: JobApplicant;
  pending: boolean;
  submitDecision: (formData: FormData) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="assignment-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="applicant-acceptance-title"
    >
      <section className="assignment-dialog">
        <p className="eyebrow">Son kontrol</p>
        <h2 id="applicant-acceptance-title">Başvuruyu kabul et</h2>
        <h3>{applicant.applicant.fullName || "Adı paylaşılmadı"}</h3>
        <dl className="assignment-dialog-facts">
          <div>
            <dt>Tam iş adresi açılır</dt>
            <dd>
              Kabul ettiğin anda bu adaya ilanın yaklaşık konumu değil sokak, bina ve
              kapı numarasıyla tam adresi ve haritadaki kesin noktası görünür olur.
              Açılan adres geri kapatılamaz.
            </dd>
          </div>
          <div>
            <dt>Atama kurulur</dt>
            <dd>
              Adaya bir atama teklifi gider ve ilanın kontenjanından bir yer tükenir.
              Cevabını bekleyen teklif de yer kaplar.
            </dd>
          </div>
          <div>
            <dt>Karar geri alınamaz</dt>
            <dd>
              Kabul edilmiş bir başvuru bu ekrandan reddedilemez. Vazgeçmen gerekirse
              kurulan atamayı atama ekranından iptal etmen gerekir.
            </dd>
          </div>
        </dl>
        <div className="assignment-dialog-actions">
          <form action={submitDecision} onSubmit={onClose}>
            <input type="hidden" name="applicationId" value={applicant.id} />
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="decision" value="ACCEPTED" />
            <button className="button button-primary button-small" type="submit" disabled={pending}>
              {pending ? "Karar gönderiliyor" : "Kabulü onayla"}
            </button>
          </form>
          <button
            className="button button-secondary button-small"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            Vazgeç
          </button>
        </div>
      </section>
    </div>
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
 * Karar reddi.
 *
 * Altı kod ayrışıyor ve altısında kullanıcının yapacağı iş farklı. Aile
 * metinleri hiçbirinde doğru olmazdı: "Gönderdiğin bilgilerden bazıları
 * geçerli değil" cevaplanmış bir başvuruda düzeltilecek bir alan aratır,
 * "Bu işlem için yetkin yok" ise kontenjan dolduğunda yanlış bir sebep söyler.
 *
 * 404 kasten belirsiz: backend yetkisiz çağırana başvurunun varlığını
 * sızdırmıyor (`assertCurrentUserIsEmployerOf` her iki hâlde de
 * `JOB_APPLICATION_NOT_FOUND` atıyor) ve ekranın metni de ayırmıyor.
 */
function decisionErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "DECISION_REASON_REQUIRED") {
    return "Reddi göndermek için bir gerekçe yazman gerekiyor.";
  }
  if (errorCode === "JOB_APPLICATION_ALREADY_RESPONDED") {
    return "Bu başvuru daha önce cevaplanmış; karar değiştirilemiyor. Güncel durumu görmek için sayfayı yenile.";
  }
  if (errorCode === "JOB_APPLICATION_ALREADY_WITHDRAWN") {
    return "Aday bu başvuruyu geri çekti; artık karar verilemiyor.";
  }
  if (errorCode === "JOB_APPLICATION_JOB_HEADCOUNT_FULL") {
    return "İlanın kontenjanı doldu; bu adayı kabul edemezsin. Cevap bekleyen teklifler de yer kaplıyor.";
  }
  if (errorCode === "JOB_APPLICATION_JOB_CANCELLED") {
    return "İlan iptal edilmiş; başvuruları artık cevaplanamıyor.";
  }
  if (errorCode === "JOB_APPLICATION_NOT_FOUND") {
    return "Bu başvuru bulunamadı ya da cevaplama yetkin yok.";
  }
  if (errorCode === "VALIDATION_FAILED") {
    return "Bu karar gönderilemedi; sayfayı yenileyip yeniden dene.";
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
