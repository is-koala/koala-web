import {
  idleActionState,
  type ActionFailure,
  type ActionFor,
  type KeyedActionState,
} from "@/lib/form-state";
import type { BackendPage } from "@/lib/pagination";
import type { MessagingAvailability } from "@/messaging/contract";

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
  /**
   * `answeredDateTime`, `rejectionReason`, `assignmentId` — üçü de
   * is-koala/koala-backend#282 ile `JobApplicantDto`'ya geliyor; gelene
   * kadar `null` ve kart o satırı çizmiyor. `assignmentId` geldiğinde kabul
   * edilmiş adayın ataması doğrudan okunuyor ve işverenin bütün atamalarını
   * tarayan yol kapanıyor (`readApplicantAssignments`).
   */
  readonly answeredAt: string | null;
  readonly rejectionReason: string | null;
  readonly assignmentId: string | null;
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
export type ApplicantDossierState = KeyedActionState<
  "userId",
  { readonly dossier: ApplicantDossier }
>;

export const idleApplicantDossierState: ApplicantDossierState = idleActionState;

export type ApplicantDossierAction = ActionFor<ApplicantDossierState>;

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
  /** Reddin gövdesi ortak; küme **hatada da** taşınıyor, o yüzden `KeyedActionState` değil. */
  | ({ readonly status: "error"; readonly workerIds?: readonly string[] } & ActionFailure);

export const idleTalentPoolState: TalentPoolState = idleActionState;

export type TalentPoolAction = ActionFor<TalentPoolState>;

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
  | ({ readonly status: "error" } & ActionFailure);

export const idleTalentPoolRemovalState: TalentPoolRemovalState = idleActionState;

export type TalentPoolRemovalAction = ActionFor<TalentPoolRemovalState>;

/**
 * Konuşma açma durumu `@/messaging/contract` içinde: çalışanın iş ayrıntısı
 * da aynı üçlüyü kullanıyor ve iki kopya birbirinden ayrışırdı. Buradaki
 * adlar eski çağıranlar için duruyor.
 */
export type { ConversationAction, ConversationState } from "@/messaging/contract";
export { idleConversationState } from "@/messaging/contract";

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
  /**
   * Sunucunun bildirdiği karar; okunamadığında `UNKNOWN`.
   *
   * Üçüncü dal bir ihtimal değil bir **zorunluluk**: kabul dalı ekranda "tam
   * iş adresi adaya açıldı" yazıyor ve atama bağlantısı çiziyor. Tanınmayan
   * bir durumu kabule saymak, geri alınamaz bir ifşanın olduğunu iddia etmek
   * olurdu — bu ekranın söyleyebileceği en pahalı yanlış.
   */
  readonly decision: ApplicationDecision | "UNKNOWN";
  readonly assignmentId: string | null;
  /**
   * `ShortJobAssignmentDto.messagingAvailable*`; kabul anında hep
   * `PAYMENT_REQUIRED` — kart, sunucu listesi tazelenene kadar mesaj
   * düğmesi yerine ödeme yolunu buradan çizer. Alan yoksa `null`.
   */
  readonly messaging: MessagingAvailability | null;
};

/**
 * Bir adayın bu ilandaki ataması — mesaj kapısının kaynağı.
 *
 * `JobApplicantDto` atama taşımıyor; kabul edilmiş adayın ataması ve onun
 * `messagingAvailable` kararı işverenin atama listesinden
 * (`GET /users/me/assignments?asEmployer=true`, `MyAssignmentDto`) ilan ve
 * işçi kimliğiyle eşleştirilerek okunuyor. Eşleşmeyen aday — henüz karar
 * bekleyen ya da reddedilen — bu listede yok ve mesaj düğmesi hiç çizilmiyor:
 * atama yokken açılacak bir sohbet de yok.
 */
export type ApplicantAssignment = {
  readonly workerId: string;
  readonly assignmentId: string;
  readonly messaging: MessagingAvailability | null;
};

/**
 * Kartın mesaj kapısı: bu oturumdaki kabul önce, sunucu listesi sonra.
 *
 * Oturumdaki kabul kazanıyor çünkü listedeki kayıt sayfa yüklendiğinde
 * okundu; kabul ondan sonra kuruldu ve kararı daha taze. İkisi de yoksa
 * `null`, yani kart mesaj hakkında hiç konuşmuyor.
 */
export function applicantMessaging(input: {
  readonly decidedNow: ApplicationDecisionOutcome | null;
  /** Adayın atama listesindeki kaydı; yoksa `null`. */
  readonly assignment: ApplicantAssignment | null;
}): { readonly assignmentId: string; readonly messaging: MessagingAvailability } | null {
  const decided = input.decidedNow;
  if (decided !== null && decided.decision === "ACCEPTED") {
    return decided.assignmentId && decided.messaging
      ? { assignmentId: decided.assignmentId, messaging: decided.messaging }
      : null;
  }
  const { assignment } = input;
  if (assignment === null || assignment.messaging === null) return null;
  return { assignmentId: assignment.assignmentId, messaging: assignment.messaging };
}

/**
 * Karar eyleminin durumu.
 *
 * Başvuru kimliği durumun içinde: liste tek bir `useActionState` paylaşıyor ve
 * cevabın hangi karta ait olduğu başka türlü okunamazdı — aday panelinin
 * `userId` taşımasıyla aynı sebep.
 */
export type ApplicationDecisionState = KeyedActionState<
  "applicationId",
  { readonly outcome: ApplicationDecisionOutcome }
>;

export const idleApplicationDecisionState: ApplicationDecisionState = idleActionState;

export type ApplicationDecisionAction = ActionFor<ApplicationDecisionState>;

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

const unreadableDecisionReason =
  "Sonucu bilmeden ikinci bir karar göndermek geri alınamaz bir sonuç doğurabilir; önce sayfayı yenile.";

const withdrawnReason =
  "Aday başvurusunu geri çekti. Geri çekilmiş bir başvuru kabul de edilemiyor, reddedilemiyor da.";

const unknownStatusReason =
  "Bu başvurunun durumu okunamadı. Sayfayı yenileyip güncel durumu gör.";

const headcountHiredReason =
  "İlanın kontenjanı doldu; yeni bir aday kabul edilemez. Kabul etmek istersen önce kurulmuş bir atamayı iptal etmen gerekiyor.";

const headcountAcceptedReason =
  "Kabul edilmiş başvurular ilanın kontenjanını doldurdu; cevabını bekleyen teklifler de yer kaplıyor. Kabul ettiğin bir aday teklifi geri çevirirse yer yeniden açılır — sayfayı yenileyip güncel duruma bak.";

/**
 * İlanın kabul kapısını kapatan doluluk.
 *
 * Neden `HeadcountStatus.full` değil: o alan `hiredCount`tan türüyor ve
 * **başka bir küme** sayıyor. Kontenjan şeridi ile kabul kapısı ayrı iki
 * soruya cevap veriyor, aynı sayıyı paylaşamıyorlar.
 */
export type AcceptanceHeadcount = {
  readonly full: boolean;
  /** Doluysa nedeni; yer varken `null`. */
  readonly reason: string | null;
};

/** Kontenjanı bildirilmemiş ya da yeri kalmış ilan. */
export const openAcceptanceHeadcount: AcceptanceHeadcount = { full: false, reason: null };

/**
 * Kabul kapısının okuduğu doluluk.
 *
 * **Sunucuda iki ayrı küme var ve ekran uzun süre yanlışına baktı.**
 * `JobDetailDto.hiredCount` yalnız `{CONFIRMED, IN_PROGRESS, COMPLETED}`
 * atamalarını sayıyor (`JobManager.java:280`); kabulü reddeden kapı ise
 * `PENDING_CONFIRMATION` teklifleri de yer kaplıyor sayıyor
 * (`JobAssignmentManager.java:71`, `countOccupiedSlots`). Tek kişilik bir
 * ilanın tek yeri bekleyen bir teklifteyken `hiredCount` hâlâ 0: kapı açık
 * kalıyor ve kullanıcı geri alınamaz sandığı düğmeden 409 yiyor. #80 tam
 * olarak bunu reddediyor.
 *
 * **Sunucu yer tüketen sayıyı hiçbir uçtan vermiyor.** `countOccupiedSlots`
 * yalnız `assertOpeningAvailable` içinden çağrılıyor, `JobDetailDto` üzerinde
 * karşılığı yok ve atama listesi (`GET /users/me/assignments`) ilana göre
 * süzülemiyor — işverenin bütün atamalarını sayfalayıp elemek gerekirdi.
 * Sayı bu yüzden **türetiliyor**, ve türetmenin dayanağı şu: bir `JobAssignment`
 * yalnız `respondToApplication`ın kabul dalında kuruluyor
 * (`JobApplicationManager.java:197`, kaynakta tek `new JobAssignment()`), ve
 * `ACCEPTED` bir başvuru durumu bir daha değişmiyor. Yani bu ilan için
 * **kabul edilmiş başvuru sayısı = bugüne kadar kurulmuş atama sayısı**, ve
 * başvuru listesi ucu sayfasız (`findAllByJobId`), yani sayı tam.
 *
 * Üç sayının sırası kesin: `hiredCount ≤ yer tüketen ≤ kabul edilmiş başvuru`.
 * Kapı üsttekini okuyor, çünkü yanılma yönü seçiliyor: `hiredCount` "yer var"
 * deyip 409'a yolluyor, kabul sayısı ise yalnız bir aday teklifi geri
 * çevirdiğinde ya da atama iptal edildiğinde fazladan kapatıyor — o hâlde de
 * düğme gizlenmiyor, gerekçesi yanında yazılı ve yenilemeyi söylüyor.
 * `Math.max` ikisini birleştiriyor: liste bayatsa bile sayı `hiredCount`un
 * altına düşmüyor.
 *
 * `decidedNow` bu oturumda verilmiş kabulleri de sayıyor. En olası senaryo bu:
 * ilk adayı kabul et, hemen ikinciye bak. Sunucu listesi tazelenene kadar ilk
 * kart hâlâ `APPLIED` görünüyor ve o aralıkta ikinci kartın kabulü açık
 * kalırdı.
 */
export function acceptanceHeadcount(input: {
  readonly headcount: number | null;
  readonly hiredCount: number;
  readonly applicants: readonly JobApplicant[];
  readonly decidedNow: ReadonlyMap<string, ApplicationDecisionOutcome>;
}): AcceptanceHeadcount {
  // `headcount: null` sınırsız ilan: `assertOpeningAvailable` alanı null
  // görünce hiç saymadan geçiyor, yani kapatılacak bir kapı yok.
  if (input.headcount === null) return openAcceptanceHeadcount;

  const hired = Math.max(0, input.hiredCount);
  const occupied = Math.max(hired, acceptedApplications(input.applicants, input.decidedNow));
  if (occupied < input.headcount) return openAcceptanceHeadcount;

  return {
    full: true,
    reason: hired >= input.headcount ? headcountHiredReason : headcountAcceptedReason,
  };
}

/** Bu ilan için kurulmuş atama sayısı; oturum içinde verilen kabuller dahil. */
function acceptedApplications(
  applicants: readonly JobApplicant[],
  decidedNow: ReadonlyMap<string, ApplicationDecisionOutcome>,
): number {
  return applicants.filter(
    (applicant) =>
      applicant.status === "ACCEPTED" ||
      decidedNow.get(applicant.id)?.decision === "ACCEPTED",
  ).length;
}

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
 * bir karara açık kalırdı. Kararın **kendisi** taşınıyor, yalnız "verildi mi"
 * bayrağı değil: sunucunun cevabı okunamadığında gerekçe ayrışıyor.
 */
export function applicationDecisionGate(input: {
  readonly status: ApplicationStatus;
  readonly headcount: AcceptanceHeadcount;
  readonly decidedNow: ApplicationDecisionOutcome | null;
}): ApplicationDecisionGate {
  if (input.decidedNow !== null) {
    return closed(
      input.decidedNow.decision === "UNKNOWN" ? unreadableDecisionReason : decidedReason,
    );
  }
  if (input.status === "ACCEPTED" || input.status === "REJECTED") return closed(decidedReason);
  if (input.status === "WITHDRAWN") return closed(withdrawnReason);
  if (input.status !== "APPLIED") return closed(unknownStatusReason);

  return {
    canAccept: !input.headcount.full,
    canReject: true,
    closedReason: null,
    acceptClosedReason: input.headcount.reason,
  };
}

function closed(reason: string): ApplicationDecisionGate {
  return { canAccept: false, canReject: false, closedReason: reason, acceptClosedReason: null };
}

/**
 * Başvuru durumunun işveren gözünden etiketi.
 *
 * İş arayanın gördüğü metinlerle aynı değil ("Kabul edildi" ikisinde de var
 * ama "Aday başvurusunu geri çekti" yalnız burada). Başvuru listesi ve
 * işveren ana sayfası aynı sözlüğü okur; iki ekranda iki ayrı metin olmasın.
 */
export const applicantStatusLabel: Readonly<Record<ApplicationStatus, string>> = {
  APPLIED: "Karar bekliyor",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Aday başvurusunu geri çekti",
  UNKNOWN: "Durum güncelleniyor",
};

/**
 * Rozet seviyesinin Türkçesi.
 *
 * `NONE` ve `UNKNOWN` boş: ilki seviyesi olmayan bir rozet ailesi
 * (`BadgeTier.NONE`), ikincisi backend'in tanımadığımız bir seviye
 * göndermesi. İkisinde de rozet adı tek başına doğru; uydurulmuş bir seviye
 * yazmak yanlış olurdu. Aday kartı ve aday dosyası sayfası aynı sözlüğü
 * okur.
 */
export const badgeTierLabel: Readonly<Record<BadgeTier, string>> = {
  BRONZE: "Bronz",
  SILVER: "Gümüş",
  GOLD: "Altın",
  NONE: "",
  UNKNOWN: "",
};

/** "3 rozet · 1 altın" — en yüksek seviye sayısıyla birlikte. */
export function badgeSummary(badges: readonly ApplicantBadge[]): string {
  const count = `${badges.length} rozet`;
  for (const tier of ["GOLD", "SILVER", "BRONZE"] as const) {
    const tierCount = badges.filter((badge) => badge.tier === tier).length;
    if (tierCount > 0) return `${count} · ${tierCount} ${badgeTierLabel[tier].toLocaleLowerCase("tr-TR")}`;
  }
  return count;
}

/** "4.6 / 5 · 7 değerlendirme"; değerlendirme yoksa `null` ve ekran kendi boş cümlesini yazar. */
export function ratingSummaryLabel(summary: ApplicantRatingSummary | null): string | null {
  if (summary === null || summary.reviewCount <= 0) return null;
  return `${summary.averageRating} / 5 · ${summary.reviewCount} değerlendirme`;
}
