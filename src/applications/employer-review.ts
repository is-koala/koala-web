import type { BackendPage } from "@/lib/pagination";

import type { ApplicationStatus } from "./contract";

/**
 * İşverenin bir ilana gelen başvuruları inceleme modeli.
 *
 * `server-only` yok, bilerek: hem sunucuda çizilen sayfa hem tarayıcıdaki
 * liste aynı tabloyu okuyor. İçinde ağ çağrısı ya da gizli değer yok.
 */

/** Kayıtta iki değer var ama başvuru listesinde ayrımı yapan bir isim yok. */
export type ApplicantFilter = Exclude<ApplicationStatus, "UNKNOWN"> | "ALL";

/**
 * `JobApplicantDto`'nun ekranda kullanılan hâli.
 *
 * `occupation` alanı backend'de `jobTitle` adını taşıyor ama **ilanın başlığı
 * değil**: `JobApplicationMapper.java:26` onu `user.jobTitle` alanından
 * dolduruyor, yani adayın mesleği. Ad burada düzeltiliyor ki kart onu ilanın
 * adı sanıp yanlış yere basmasın.
 */
export type JobApplicant = {
  readonly id: string;
  readonly status: ApplicationStatus;
  readonly appliedAt: string;
  readonly notes: string | null;
  readonly cvUrl: string | null;
  readonly occupation: string | null;
  /** `SafeUserDto`; tam adres ya da iletişim bilgisi taşımaz. */
  readonly applicant: {
    readonly id: string;
    readonly fullName: string;
    readonly profilePictureUrl: string | null;
  };
};

/**
 * Ekranda bir anda çizilen kart sayısı.
 *
 * `GET /jobs/{jobId}/applications` sayfalı değil (`JobsController.java:231`):
 * yanıt kaç başvuru varsa hepsini tek listede getiriyor. Sayfalamayı bu yüzden
 * istemci yapıyor; sunucudan gelen listenin uzunluğu ekranın maliyetini
 * belirlemesin diye kart üretimi bu sayıyla sınırlı.
 */
export const applicantPageSize = 20;

/** `PublicProfileDto`; tam adres taşımaz, en dar konum il/ilçe. */
export type ApplicantProfile = {
  readonly id: string;
  readonly fullName: string;
  readonly profilePictureUrl: string | null;
  readonly occupation: string | null;
  readonly about: string | null;
  readonly cityName: string | null;
  readonly districtName: string | null;
  readonly cvUrl: string | null;
};

/**
 * `RatingSummaryDto`. Ortalama puan dize olarak taşınıyor: backend `BigDecimal`
 * gönderiyor ve yuvarlamayı istemcide yeniden üretmek yanlış sayı yazardı.
 */
export type ApplicantRatingSummary = {
  readonly reviewCount: number;
  readonly averageRating: string;
};

/** `ReviewDto`. Anonim değerlendirmede yazar adı yanıtta zaten yok. */
export type ApplicantReview = {
  readonly id: string;
  readonly authorName: string | null;
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string;
};

/**
 * `BadgeDto`'nun ekranda kullanılan hâli.
 *
 * Yanıt yedi alan taşıyor; kart üçünü çiziyor. `earnedAt`, `description`,
 * `family` ve `iconUrl` sınırı geçmiyor: işverenin sorduğu soru "bu adayın
 * hangi rozetleri var", "ne zaman kazandı" değil, ve rozetin ikonu için
 * ekranda yer yok.
 */
export type ApplicantBadge = {
  readonly code: string;
  readonly name: string;
  readonly tier: BadgeTier;
};

/** `BadgeTier`; tanınmayan değer `UNKNOWN` olur ve seviye yazılmaz. */
export type BadgeTier = "BRONZE" | "SILVER" | "GOLD" | "NONE" | "UNKNOWN";

/** Aday panelinin tek parça görünümü; özet henüz yoksa `null`. */
export type ApplicantDossier = {
  readonly profile: ApplicantProfile;
  readonly ratingSummary: ApplicantRatingSummary | null;
  readonly reviews: readonly ApplicantReview[];
  /** `GET /users/{id}/badges`; kazanılmış rozet geri alınmıyor. */
  readonly badges: readonly ApplicantBadge[];
};

/** `TalentPoolEntryDto`; havuz listesi ve kart rozeti bunu paylaşır. */
export type TalentPoolEntry = {
  readonly id: string;
  readonly workerId: string;
  readonly fullName: string;
  readonly profilePictureUrl: string | null;
  readonly note: string | null;
  readonly createdAt: string;
};

export type TalentPoolPage = BackendPage<TalentPoolEntry>;

/** Dilimlenmiş liste; alan adları backend'in `PageDto` sözleşmesini izler. */
export type ApplicantPage = {
  readonly items: readonly JobApplicant[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

/**
 * Aday panelinin durumu.
 *
 * Kimlik durumun içinde taşınıyor: liste tek bir `useActionState` paylaşıyor
 * ve panelin hangi karta ait olduğu başka türlü okunamazdı.
 */
export type ApplicantDossierState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly userId: string; readonly dossier: ApplicantDossier }
  | {
      readonly status: "error";
      readonly userId: string;
      readonly errorCode: string;
      readonly httpStatus: number;
    };

export const idleApplicantDossierState: ApplicantDossierState = { status: "idle" };

export type ApplicantDossierAction = (
  state: ApplicantDossierState,
  formData: FormData,
) => Promise<ApplicantDossierState>;

/**
 * Havuz üyeliği eyleminin durumu.
 *
 * Başarılı yanıt güncel kimlik kümesini geri taşıyor: rozet sunucudan gelen
 * ilk kümede donsaydı, kullanıcı eklediği adayı sayfayı yenilemeden havuzda
 * göremezdi.
 */
export type TalentPoolState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly workerIds: readonly string[] }
  | {
      readonly status: "error";
      readonly errorCode: string;
      readonly httpStatus: number;
      readonly workerIds?: readonly string[];
    };

export const idleTalentPoolState: TalentPoolState = { status: "idle" };

export type TalentPoolAction = (
  state: TalentPoolState,
  formData: FormData,
) => Promise<TalentPoolState>;

/**
 * Havuz listesinden çıkarma.
 *
 * Kümeyi taşımıyor: liste ekranı `revalidatePath` ile yeniden çiziliyor ve
 * satır kendiliğinden düşüyor. Başvuru ekranındaki rozetin tersine burada
 * güncellenecek yerel bir durum yok.
 */
export type TalentPoolRemovalState =
  | { readonly status: "idle" }
  | { readonly status: "done" }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleTalentPoolRemovalState: TalentPoolRemovalState = { status: "idle" };

export type TalentPoolRemovalAction = (
  state: TalentPoolRemovalState,
  formData: FormData,
) => Promise<TalentPoolRemovalState>;

/** Konuşma açma başarılıysa sunucu yönlendiriyor; geriye yalnız red kalıyor. */
export type ConversationState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleConversationState: ConversationState = { status: "idle" };

export type ConversationAction = (
  state: ConversationState,
  formData: FormData,
) => Promise<ConversationState>;

/** Havuz eyleminin tanınan iki adı; gövde tarayıcıdan geliyor. */
export type TalentPoolOperation = "add" | "remove";

export function isTalentPoolOperation(value: string): value is TalentPoolOperation {
  return value === "add" || value === "remove";
}

export function applicantsInFilter(
  applicants: readonly JobApplicant[],
  filter: ApplicantFilter,
): readonly JobApplicant[] {
  if (filter === "ALL") return applicants;
  return applicants.filter((applicant) => applicant.status === filter);
}

/**
 * İstenen sayfanın kayıtları.
 *
 * Aralık dışındaki sayfa numarası son sayfaya sabitlenir, boş bir ekrana
 * düşülmez. Numara **adres çubuğundan gelmiyor** — `ApplicantReview` onu
 * yerel durumda tutuyor, çünkü uç sayfalı değil ve sayfayı adrese yazmak her
 * tıklamada bütün listeyi yeniden indirmek olurdu. Sabitleme yine de yük
 * taşıyor: liste bir prop, ve sunucu tazelemesinden sonra kısalan bir listede
 * elde kalan numara son sayfanın ötesinde kalır.
 */
export function applicantPage(
  applicants: readonly JobApplicant[],
  page: number,
  size: number = applicantPageSize,
): ApplicantPage {
  const totalElements = applicants.length;
  const totalPages = Math.ceil(totalElements / size);
  const current = Math.min(Math.max(0, Math.trunc(page)), Math.max(0, totalPages - 1));
  const start = current * size;

  return {
    items: applicants.slice(start, start + size),
    page: current,
    size,
    totalElements,
    totalPages,
    first: current === 0,
    last: current >= totalPages - 1,
  };
}

/**
 * İşverenin bir başvuruya verebileceği iki cevap.
 *
 * `AnswerApplicationDto.status` bir dize alanı ama `JobApplicationManager`
 * yalnız bu ikisini kabul ediyor: başka bir `ApplicationStatus` değeri
 * `JOB_APPLICATION_INVALID_STATUS_TRANSITION` ile geri dönüyor. Tür bu yüzden
 * `ApplicationStatus`'un tamamı değil.
 */
export type ApplicationDecision = "ACCEPTED" | "REJECTED";

/** Karar adı tarayıcıdan geliyor; gövdeye konmadan önce tanınması gerekiyor. */
export function isApplicationDecision(value: string): value is ApplicationDecision {
  return value === "ACCEPTED" || value === "REJECTED";
}

/**
 * Kabul edilen başvurunun ardından kurulan atama.
 *
 * `JobApplicationDetailDto.assignment` yalnız **kabul** yanıtında dolu;
 * reddedilen başvuruda alan hiç yok. Kimlik burada taşınıyor çünkü başvuru
 * listesi ucu (`JobApplicantDto`) atama kimliği taşımıyor — karar anında
 * öğrenilmezse bir daha bu ekrandan okunamıyor.
 */
export type ApplicationDecisionOutcome = {
  readonly decision: ApplicationDecision;
  readonly assignmentId: string | null;
};

/**
 * Karar eyleminin durumu.
 *
 * Başvuru kimliği durumun içinde: liste tek bir `useActionState` paylaşıyor ve
 * cevabın hangi karta ait olduğu başka türlü okunamazdı — aday panelinin
 * `userId` taşımasıyla aynı sebep.
 */
export type ApplicationDecisionState =
  | { readonly status: "idle" }
  | {
      readonly status: "done";
      readonly applicationId: string;
      readonly outcome: ApplicationDecisionOutcome;
    }
  | {
      readonly status: "error";
      readonly applicationId: string;
      readonly errorCode: string;
      readonly httpStatus: number;
    };

export const idleApplicationDecisionState: ApplicationDecisionState = { status: "idle" };

export type ApplicationDecisionAction = (
  state: ApplicationDecisionState,
  formData: FormData,
) => Promise<ApplicationDecisionState>;

/**
 * Red gerekçesinin sunucudaki üst sınırı.
 *
 * `JobApplication.rejectionReason` `@Column(length = 500)` ile saklanıyor ve
 * `AnswerApplicationDto` üzerinde bir `@Size` yok: daha uzun bir metin
 * doğrulamaya değil veritabanına çarpar ve kullanıcı düzeltilecek alanı
 * göremezdi. Sınır bu yüzden istemcide duruyor.
 */
export const rejectionReasonMaxLength = 500;

/**
 * Bir kartın karar kapısı.
 *
 * Kabul ve red ayrı ayrı taşınıyor çünkü kapanma sebepleri ayrışıyor:
 * kontenjan dolu bir ilanda red hâlâ açık, kabul değil. Kapalı olan her
 * eylemin yanında **yazılı** bir sebep var — düğmeyi gizlemek ya da sebepsiz
 * kapatmak, kullanıcıyı 409 yiyene kadar aramaya bırakırdı.
 */
export type ApplicationDecisionGate = {
  readonly canAccept: boolean;
  readonly canReject: boolean;
  /** Karar tümüyle kapalıysa nedeni; açıkken `null`. */
  readonly closedReason: string | null;
  /** Yalnız kabulün kapalı olduğu hâlin nedeni; kabul açıkken `null`. */
  readonly acceptClosedReason: string | null;
};

const decidedReason =
  "Bu başvuruya karar verildi. Karar geri alınamıyor; kabul ettiğin adayın işini bırakması gerekiyorsa atama ekranından iptal edebilirsin.";

const withdrawnReason =
  "Aday başvurusunu geri çekti. Geri çekilmiş bir başvuru kabul de edilemiyor, reddedilemiyor da.";

const unknownStatusReason =
  "Bu başvurunun durumu okunamadı. Sayfayı yenileyip güncel durumu gör.";

const headcountFullReason =
  "İlanın kontenjanı doldu; yeni bir aday kabul edilemez. Kabul etmek istersen önce kurulmuş bir atamayı iptal etmen gerekiyor.";

/**
 * Karar kapısının tek kaynağı.
 *
 * Kural sunucudan okundu (`JobApplicationManager.respondToApplication`):
 * `WITHDRAWN` başvuru `JOB_APPLICATION_ALREADY_WITHDRAWN`, cevaplanmış başvuru
 * `JOB_APPLICATION_ALREADY_RESPONDED`, kontenjanı dolu ilanda kabul
 * `JOB_APPLICATION_JOB_HEADCOUNT_FULL` ile reddediliyor — üçü de 409. Ekran
 * bunları önden gösteriyor ki kullanıcı geri alınamaz bir düğmeye basıp
 * sunucudan öğrenmesin.
 *
 * `decidedNow` bu oturumda verilmiş kararı taşıyor: sunucu listesi
 * tazelenene kadar `status` hâlâ `APPLIED` görünüyor ve kart o aralıkta ikinci
 * bir karara açık kalırdı.
 */
export function applicationDecisionGate(input: {
  readonly status: ApplicationStatus;
  readonly headcountFull: boolean;
  readonly decidedNow: boolean;
}): ApplicationDecisionGate {
  if (input.decidedNow) return closed(decidedReason);
  if (input.status === "ACCEPTED" || input.status === "REJECTED") return closed(decidedReason);
  if (input.status === "WITHDRAWN") return closed(withdrawnReason);
  if (input.status !== "APPLIED") return closed(unknownStatusReason);

  return {
    canAccept: !input.headcountFull,
    canReject: true,
    closedReason: null,
    acceptClosedReason: input.headcountFull ? headcountFullReason : null,
  };
}

function closed(reason: string): ApplicationDecisionGate {
  return { canAccept: false, canReject: false, closedReason: reason, acceptClosedReason: null };
}
