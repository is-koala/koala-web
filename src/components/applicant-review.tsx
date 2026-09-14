"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  acceptanceHeadcount,
  applicantMessaging,
  applicantPage,
  applicantStatusLabel,
  applicantsInFilter,
  applicationDecisionGate,
  badgeSummary,
  badgeTierLabel,
  idleApplicantDossierState,
  idleApplicationDecisionState,
  idleConversationState,
  idleTalentPoolState,
  rejectionReasonMaxLength,
  type AcceptanceHeadcount,
  type ApplicantAssignment,
  type ApplicantBadge,
  type ApplicantDossier,
  type ApplicantDossierAction,
  type ApplicantFilter,
  type ApplicationDecisionAction,
  type ApplicationDecisionGate,
  type ApplicationDecisionOutcome,
  type ApplicationDecisionState,
  type ConversationAction,
  type JobApplicant,
  type TalentPoolAction,
} from "@/applications/employer-review";
import { AssignmentDialog } from "@/components/assignment-dialog";
import { MessagingGate } from "@/components/messaging/messaging-gate";
import { ErrorState } from "@/components/states";
import { EmptyStateCard, Field, StatusBadge, applicationStatusTone, fieldDescribedBy } from "@/components/ui";
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
  assignments,
  headcount,
  hiredCount,
  dossierAction,
  talentPoolAction,
  conversationAction,
  decisionAction,
}: {
  jobId: string;
  applicants: readonly JobApplicant[];
  /** Sunucudan gelen ilk üyelik kümesi; eylem sonrası yerine yenisi geçer. */
  inTalentPool: readonly string[];
  /** İlanın atamaları, işçi başına bir; mesaj kapısının kaynağı (#157). */
  assignments: readonly ApplicantAssignment[];
  /** İlanın kaç kişilik olduğu; `null` ise sınırsız ve kapatılacak kapı yok. */
  headcount: number | null;
  /** `JobDetailDto.hiredCount`; kabul kapısının okuduğu kümenin **alt sınırı**. */
  hiredCount: number;
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

  /*
    Doluluk kararı burada, sayfada değil: kabul kapısının okuduğu küme bu
    oturumda verilmiş kabulleri de sayıyor ve o sayı yalnız burada biliniyor.
    Sunucu listesi tazelenene kadar kabul edilmiş kart hâlâ `APPLIED` görünüyor.
  */
  const headcountGate = useMemo(
    () => acceptanceHeadcount({ headcount, hiredCount, applicants, decidedNow: decided }),
    [applicants, decided, headcount, hiredCount],
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
  const assignmentsByWorker = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.workerId, assignment])),
    [assignments],
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
              assignment={assignmentsByWorker.get(applicant.applicant.id) ?? null}
              headcount={headcountGate}
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
          /*
            Diyalog da kapıdan geçiyor. Kapı açıkken açıldı diye açık kalmıyor:
            yandaki kart kabul edilip kontenjan dolduğunda bu düğme hâlâ canlı
            olurdu ve kullanıcı geri alınamaz sandığı düğmeden 409 yerdi.
          */
          gate={applicationDecisionGate({
            status: acceptance.status,
            headcount: headcountGate,
            decidedNow: decided.get(acceptance.id) ?? null,
          })}
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
  assignment,
  headcount,
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
  /** Adayın bu ilandaki ataması; mesaj kapısı ve atama yolu buradan (#157). */
  assignment: ApplicantAssignment | null;
  headcount: AcceptanceHeadcount;
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
  const messaging = applicantMessaging({ decidedNow, assignment });

  return (
    <article className="application-card applicant-card" aria-labelledby={titleId}>
      <div className="application-card-body">
        <StatusBadge tone={applicationStatusTone(applicant.status)}>
          {applicantStatusLabel[applicant.status]}
        </StatusBadge>
        <div className="applicant-identity">
          <ApplicantAvatar applicant={applicant} />
          <h2 id={titleId}>{applicant.applicant.fullName || "Adı paylaşılmadı"}</h2>
        </div>
        <ApplicantCompareStrip dossier={dossier} />
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

          {/*
            Mesaj düğmesi yalnız atamanın ödemesi emanete düştüğünde
            (`messagingAvailable`, #157). Karar bekleyen adayın ataması yok,
            yani kapı da yok: backend `POST /jobs/{jobId}/conversation`'ı
            ödeme öncesi 403 ile kapatıyor ve düğmeyi çizmek kullanıcıyı o
            redde yollamak olurdu.
          */}
          {messaging ? (
            <MessagingGate
              availability={messaging.messaging}
              party="employer"
              assignmentId={messaging.assignmentId}
            >
              <form action={submitConversation}>
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="workerId" value={workerId} />
                <button className="button button-secondary button-small" disabled={pending.conversation}>
                  Mesaj gönder
                </button>
              </form>
            </MessagingGate>
          ) : null}
        </div>

        <ApplicantDecision
          jobId={jobId}
          applicant={applicant}
          knownAssignmentId={assignment?.assignmentId ?? null}
          headcount={headcount}
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
 * Kapalı hâl **gizlenmiyor, kilitleniyor**: eylem devre dışı kalıyor ve
 * gerekçe yanında yazılı duruyor. Kalıp kabuk kapılarının `blocking` kipiyle
 * ve `WorkSecondaryActions`'ın `blockedReason`'ıyla aynı (`AGENTS.md`);
 * düğmeyi kaldırmak kullanıcıyı "kabul düğmesi nerede" diye aramaya bırakır ve
 * aynı bileşende iki farklı kapalılık kipi olurdu.
 */
function ApplicantDecision({
  jobId,
  applicant,
  knownAssignmentId,
  headcount,
  decidedNow,
  failure,
  pending,
  submitDecision,
  onAcceptRequested,
}: {
  jobId: string;
  applicant: JobApplicant;
  /** Atama listesinden eşleşen kimlik; yoksa bağlantı listeye düşer. */
  knownAssignmentId: string | null;
  headcount: AcceptanceHeadcount;
  decidedNow: ApplicationDecisionOutcome | null;
  failure: { errorCode: string; httpStatus: number } | null;
  pending: boolean;
  submitDecision: (formData: FormData) => void;
  onAcceptRequested: () => void;
}) {
  const gate = applicationDecisionGate({
    status: applicant.status,
    headcount,
    decidedNow,
  });
  const reasonId = `applicant-rejection-${applicant.id}`;
  const assignment = assignmentHref(applicant, decidedNow, knownAssignmentId);
  // Karar tümüyle kapalıyken sebep tek: iki eylemin altına iki kez yazmak
  // aynı cümleyi tekrarlardı.
  const closedReason = gate.closedReason ?? gate.acceptClosedReason;

  return (
    <section className="applicant-decision" aria-label="Başvuru kararı">
      {failure ? (
        <p role="alert" className="form-warning">
          {decisionErrorMessage(failure.errorCode, failure.httpStatus)}
        </p>
      ) : null}

      {decidedNow ? (
        <p role="status" className="applicant-decision-done">
          {decisionNotice[decidedNow.decision]}
        </p>
      ) : null}

      {assignment ? (
        <Link className="button button-secondary button-small" href={assignment}>
          Atamayı aç
        </Link>
      ) : null}

      <div className="applicant-decision-actions">
        <button
          className="button button-primary button-small"
          type="button"
          onClick={onAcceptRequested}
          disabled={!gate.canAccept || pending}
          data-disabled-kind={!gate.canAccept ? "permanent" : undefined}
        >
          Kabul et
        </button>
      </div>
      {closedReason ? <p className="muted">{closedReason}</p> : null}

      <details className="applicant-decision-reject">
        <summary>Başvuruyu reddet</summary>
        <form className="form compact-form" action={submitDecision}>
          <input type="hidden" name="applicationId" value={applicant.id} />
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <Field
            id={reasonId}
            label="Red gerekçesi"
            hint="Aday bu açıklamayı başvuru ekranında okuyacak. Red kararı da geri alınamıyor."
          >
            <textarea
              id={reasonId}
              name="rejectionReason"
              required
              rows={3}
              maxLength={rejectionReasonMaxLength}
              disabled={!gate.canReject}
              aria-describedby={fieldDescribedBy(reasonId, { hint: true })}
            />
          </Field>
          <button
            className="button button-danger button-small"
            disabled={!gate.canReject || pending}
            data-disabled-kind={!gate.canReject ? "permanent" : undefined}
          >
            Reddi gönder
          </button>
        </form>
      </details>
    </section>
  );
}

/** Karar verildikten sonra kartın üstünde duran cümle; üç sonucun üçü ayrı. */
const decisionNotice: Readonly<Record<ApplicationDecisionOutcome["decision"], string>> = {
  ACCEPTED: "Başvuru kabul edildi. Adaya teklif gitti ve tam iş adresi ona açıldı.",
  REJECTED: "Başvuru reddedildi. Yazdığın gerekçe adayın başvuru ekranında görünecek.",
  UNKNOWN:
    "Kararın gönderildi ama sunucunun cevabı okunamadı. Kabul mü red mi işlendiğini görmek için sayfayı yenile.",
};

/** İşverenin bütün atamaları; ilana göre süzülemiyor ama karardan sonraki tek yol. */
const employerAssignmentsPath = "/isveren/atamalar";

/**
 * Atama görünümüne geçiş yolu (#37); kabul edilmemiş kartta `null`.
 *
 * İki kabul hâli var ve **ikisinde de** bağlantı çiziliyor. Bu oturumda
 * kabul edilen kartta atama kimliği elde ve doğrudan atamaya gidiliyor; daha
 * önce kabul edilmiş bir kartta kimlik `JobApplicantDto`'da yok, ama mesaj
 * kapısı için okunan atama listesi (#157) onu çoğu zaman biliyor ve o zaman
 * da doğrudan atamaya gidiliyor. Eşleşme yoksa atama listesine düşülüyor.
 * Bağlantıyı yalnız ilk hâlde çizmek, kararın ardından sayfa bir kez
 * yenilendiğinde geçiş yolunu ekrandan tümüyle silerdi.
 *
 * Okunamayan karar bağlantı çizdirmiyor: atama kurulup kurulmadığı belli değil.
 */
function assignmentHref(
  applicant: JobApplicant,
  decidedNow: ApplicationDecisionOutcome | null,
  knownAssignmentId: string | null,
): string | null {
  if (decidedNow !== null) {
    if (decidedNow.decision !== "ACCEPTED") return null;
    return decidedNow.assignmentId
      ? `/isveren/atama/${encodeURIComponent(decidedNow.assignmentId)}`
      : employerAssignmentsPath;
  }
  if (applicant.status !== "ACCEPTED") return null;
  return knownAssignmentId
    ? `/isveren/atama/${encodeURIComponent(knownAssignmentId)}`
    : employerAssignmentsPath;
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
  gate,
  pending,
  submitDecision,
  onClose,
}: {
  jobId: string;
  applicant: JobApplicant;
  /** Kartın kapısı; diyalog açıkken kapanabildiği için burada da okunuyor. */
  gate: ApplicationDecisionGate;
  pending: boolean;
  submitDecision: (formData: FormData) => void;
  onClose: () => void;
}) {
  return (
    <AssignmentDialog
      titleId="applicant-acceptance-title"
      title="Başvuruyu kabul et"
      subject={applicant.applicant.fullName || "Adı paylaşılmadı"}
      facts={acceptanceFacts}
      fields={
        <>
          <input type="hidden" name="applicationId" value={applicant.id} />
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="decision" value="ACCEPTED" />
        </>
      }
      confirmLabel="Kabulü onayla"
      pendingLabel="Karar gönderiliyor"
      pending={pending}
      blockedReason={gate.canAccept ? null : (gate.closedReason ?? gate.acceptClosedReason)}
      formAction={submitDecision}
      onClose={onClose}
    />
  );
}

const acceptanceFacts = [
  {
    term: "Tam iş adresi açılır",
    detail:
      "Kabul ettiğin anda bu adaya ilanın yaklaşık konumu değil sokak, bina ve kapı numarasıyla tam adresi ve haritadaki kesin noktası görünür olur. Açılan adres geri kapatılamaz.",
  },
  {
    term: "Atama kurulur",
    detail:
      "Adaya bir atama teklifi gider ve ilanın kontenjanından bir yer tükenir. Cevabını bekleyen teklif de yer kaplar.",
  },
  {
    term: "Karar geri alınamaz",
    detail:
      "Kabul edilmiş bir başvuru bu ekrandan reddedilemez. Vazgeçmen gerekirse kurulan atamayı atama ekranından iptal etmen gerekir.",
  },
] as const;

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

/**
 * Karşılaştırma şeridi: her kartta aynı üç hücre, aynı sırada.
 *
 * Adayları yan yana okumak için hücreler sabit — puan, rozet, konum — ve
 * özet inmemişken boş değil "incele" yazıyor: hücreyi gizlemek kartları
 * farklı boyda bırakır ve kıyaslamayı bozardı. Üçü de bugünkü alanlardan
 * geliyor (`ApplicantDossier`): mesafe backend'de yok, en yakın ölçü il/ilçe;
 * müsaitlik başvuru ya da profil yanıtında taşınmıyor ve uydurulmuyor.
 */
function ApplicantCompareStrip({ dossier }: { dossier: ApplicantDossier | null }) {
  const rating = dossier?.ratingSummary ?? null;
  const badges = dossier?.badges ?? null;
  const location = dossier
    ? [dossier.profile.districtName, dossier.profile.cityName].filter(Boolean).join(", ")
    : null;

  return (
    <dl className="applicant-compare" aria-label="Karşılaştırma">
      <div>
        <dt>Puan</dt>
        {rating && rating.reviewCount > 0 ? (
          <dd className="ui-rating">{`${rating.averageRating} · ${rating.reviewCount} değerlendirme`}</dd>
        ) : (
          <dd className="is-empty">{dossier ? "Henüz yok" : "İncele"}</dd>
        )}
      </div>
      <div>
        <dt>Rozet</dt>
        {badges && badges.length > 0 ? (
          <dd>{badgeSummary(badges)}</dd>
        ) : (
          <dd className="is-empty">{dossier ? "Henüz yok" : "İncele"}</dd>
        )}
      </div>
      <div>
        <dt>Konum</dt>
        {location ? (
          <dd>{location}</dd>
        ) : (
          <dd className="is-empty">{dossier ? "Paylaşılmadı" : "İncele"}</dd>
        )}
      </div>
    </dl>
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
    <EmptyStateCard
      title={filter === "ALL" ? "Henüz başvuru yok" : "Bu süzgeçte başvuru yok"}
      message={
        filter === "ALL"
          ? "İlanına gelen başvurular burada listelenecek."
          : "Başka bir durum seçerek listedeki adayları görebilirsin."
      }
      mascot="employer"
    />
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
 * İkisi burada `errorCode` ile ayrışıyor: ilki geçici değil kalıcı bir
 * kural, ikincisi karşı tarafın kararı. Ödeme (`MESSAGING_PAYMENT_REQUIRED`)
 * ve pencere (`MESSAGING_WINDOW_CLOSED`) reddi `src/lib/errors.ts`
 * kataloğundan geliyor — kapı bunları önden `MessagingGate` ile aynı cümleyle
 * gösteriyor ve metnin üçüncü bir kopyası olmamalı.
 */
function conversationErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "MESSAGING_NO_RELATIONSHIP_WITH_JOB") {
    return "Bu adayla yalnız kendi ilanına başvurduğu için yazışabilirsin.";
  }
  if (errorCode === "MESSAGING_BLOCKED") {
    return "Bu adayla mesajlaşma kapalı.";
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

const filterOptions: ReadonlyArray<{ value: ApplicantFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "APPLIED", label: "Bekleyenler" },
  { value: "ACCEPTED", label: "Kabul edilenler" },
  { value: "REJECTED", label: "Reddedilenler" },
  { value: "WITHDRAWN", label: "Geri çekilenler" },
];

