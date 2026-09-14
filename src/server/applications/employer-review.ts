import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { ApplicationStatus } from "@/applications/contract";
import type {
  ApplicantAssignment,
  ApplicantBadge,
  ApplicantDossier,
  ApplicantProfile,
  ApplicantRatingSummary,
  ApplicantReview,
  ApplicationDecision,
  ApplicationDecisionOutcome,
  BadgeTier,
  JobApplicant,
  TalentPoolEntry,
  TalentPoolPage,
} from "@/applications/employer-review";
import { isUuid } from "@/lib/identifiers";
import { emptyBackendPage } from "@/lib/pagination";
import { messagingAvailabilityFrom, type MessagingAvailability } from "@/messaging/contract";
import { clean, known, type PageDto } from "@/server/api/dto";
import { ApiError } from "@/server/api/errors";
import { backendPaths, notFoundStatus } from "@/server/contract";
import { readAllEmployerAssignments } from "@/server/payments/payments";
import { apiRequest } from "@/server/session/session";

/**
 * İşverenin başvuru inceleme yüzeyi.
 *
 * Beş ayrı backend ucu tek modülde toplanıyor çünkü hepsi aynı ekranın —
 * aday kartı ve aday paneli — verisi. Çağıran sayfa hangi ucun ne döndürdüğünü
 * bilmez; yalnız `@/applications/employer-review` içindeki dar modeli görür.
 */

/** `SafeUserDto`; beş alanının üçü ekranda kullanılıyor. */
type SafeUserDto = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

/**
 * `JobApplicantDto`. `jobTitle` adayın mesleği, ilanın başlığı değil.
 *
 * `answeredDateTime`, `rejectionReason` ve `assignmentId`
 * is-koala/koala-backend#282 ile geliyor; isteğe bağlı yazıldı.
 */
type JobApplicantDto = {
  id?: string | null;
  status?: string | null;
  applicationDateTime?: string | null;
  answeredDateTime?: string | null;
  rejectionReason?: string | null;
  assignmentId?: string | null;
  notes?: string | null;
  applicant?: SafeUserDto | null;
  cvUrl?: string | null;
  jobTitle?: string | null;
};

/** `PublicProfileDto`; tam adres taşımıyor, yalnız il/ilçe. */
type PublicProfileDto = SafeUserDto & {
  jobTitle?: string | null;
  about?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  cvUrl?: string | null;
};

type RatingSummaryDto = {
  reviewCount?: number | null;
  averageRating?: string | number | null;
};

type ReviewDto = {
  id?: string | null;
  author?: SafeUserDto | null;
  rating?: number | null;
  comment?: string | null;
  anonymous?: boolean | null;
  createdAt?: string | null;
};

type BadgeDto = {
  code?: string | null;
  name?: string | null;
  tier?: string | null;
};

/** `JobApplicationDetailDto`; `assignment` (`ShortJobAssignmentDto`) yalnız kabul yanıtında dolu. */
type ApplicationDecisionDto = {
  id?: string | null;
  status?: string | null;
  assignment?: {
    id?: string | null;
    messagingAvailable?: boolean | null;
    messagingAvailableReason?: string | null;
  } | null;
};

type TalentPoolEntryDto = {
  id?: string | null;
  worker?: SafeUserDto | null;
  note?: string | null;
  createdAt?: string | null;
};

const applicationStatuses = new Set<ApplicationStatus>([
  "APPLIED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
]);

const badgeTiers = new Set<BadgeTier>(["BRONZE", "SILVER", "GOLD", "NONE"]);

/** Aday panelinde gösterilen değerlendirme sayısı; tamamı profil ekranının işi. */
const reviewPreviewSize = 5;

/** Havuz listesinin kendi sayfa boyutu; `/isveren/yetenek-havuzu` bunu çiziyor. */
export const talentPoolPageSize = 20;

/**
 * Üyelik kümesi toplanırken kullanılan sayfa boyutu ve tur sınırı.
 *
 * Kart üzerindeki "havuzda mı" rozetinin tek kaynağı bu küme, ve backend
 * yalnız sayfalı bir liste veriyor. Sınır bilerek var: bir işverenin havuzu
 * beklenmedik biçimde büyüdüğünde başvuru ekranı onlarca tur atıp yavaşlamak
 * yerine eksik rozet gösterir — liste ekranı zaten doğruyu söylüyor.
 */
const membershipPageSize = 100;
const membershipPageLimit = 10;

/**
 * `GET /jobs/{jobId}/applications` — sayfalı **değil**, düz liste.
 *
 * Sayfalamayı bu yüzden istemci yapıyor (`@/applications/employer-review`).
 * Yetkisiz çağıran iki farklı yanıt alıyor: şirket ilanında 400
 * (`JOB_APPLICATION_USER_NOT_CONTACT_OF_COMPANY_TO_VIEW_APPLICATIONS`),
 * bireysel ilanda 404. İkisi de çağırana `ApiError` olarak çıkar.
 */
export async function readJobApplicants(jobId: string): Promise<readonly JobApplicant[]> {
  const applicants = await apiRequest<readonly JobApplicantDto[] | null>(
    `${backendPaths.jobs}/${encodeURIComponent(jobId)}/applications`,
    { cache: "no-store" },
  );
  return (applicants ?? []).map(toJobApplicant);
}

/**
 * Aday panelinin dört ucu tek turda.
 *
 * `GET /users/{id}/rating-summary` henüz değerlendirilmemiş bir adayda
 * `data: null` döndürüyor (`ReviewsController.java:95`); bu yüzden özet
 * isteğe bağlı bir alan, boş bir nesne değil.
 *
 * Rozetler ayrı bir uçta: `GET /users/{id}/badges`
 * (`BadgesController.badgesOf`), sayfasız düz liste. Profil ucu onları
 * taşımıyor — `PublicProfileDto` on alanının hiçbiri rozet değil — ve
 * #36 aday panelinden rozetleri de istiyor.
 */
export async function readApplicantDossier(userId: string): Promise<ApplicantDossier> {
  const encoded = encodeURIComponent(userId);
  const [profile, summary, reviews, badges] = await Promise.all([
    apiRequest<PublicProfileDto | null>(`/users/${encoded}`, { cache: "no-store" }),
    apiRequest<RatingSummaryDto | null>(`/users/${encoded}/rating-summary`, {
      cache: "no-store",
    }),
    apiRequest<PageDto<ReviewDto> | null>(
      `/users/${encoded}/reviews?page=0&size=${reviewPreviewSize}`,
      { cache: "no-store" },
    ),
    apiRequest<readonly BadgeDto[] | null>(`/users/${encoded}/badges`, { cache: "no-store" }),
  ]);

  return {
    profile: toApplicantProfile(userId, profile),
    ratingSummary: toRatingSummary(summary),
    reviews: (reviews?.content ?? []).map(toApplicantReview),
    badges: (badges ?? []).map(toApplicantBadge),
  };
}

/**
 * `GET /users/me/talent-pool` — kart rozetinin okuduğu kimlik kümesi.
 *
 * Kümeyi kimliklerle taşıyor, kayıtlarla değil: başvuru ekranının sorduğu tek
 * soru "bu aday havuzda mı" ve not/tarih alanları o soruyu değiştirmiyor.
 */
export async function readTalentPoolMembership(): Promise<ReadonlySet<string>> {
  const workerIds = new Set<string>();

  for (let pageNumber = 0; pageNumber < membershipPageLimit; pageNumber += 1) {
    const page = await apiRequest<PageDto<TalentPoolEntryDto> | null>(
      `${backendPaths.talentPool}?page=${pageNumber}&size=${membershipPageSize}`,
      { cache: "no-store" },
    );
    if (page === null) break;

    for (const entry of page.content ?? []) {
      const workerId = entry.worker?.id;
      if (workerId) workerIds.add(workerId);
    }
    if (page.last !== false) break;
  }

  return workerIds;
}

export async function readTalentPool(pageNumber: number): Promise<TalentPoolPage> {
  const page = await apiRequest<PageDto<TalentPoolEntryDto> | null>(
    `${backendPaths.talentPool}?page=${pageNumber}&size=${talentPoolPageSize}`,
    { cache: "no-store" },
  );
  if (page === null) return emptyTalentPool(pageNumber);

  return {
    content: (page.content ?? []).map(toTalentPoolEntry),
    page: page.page ?? pageNumber,
    size: page.size ?? talentPoolPageSize,
    totalElements: page.totalElements ?? 0,
    totalPages: page.totalPages ?? 0,
    first: page.first ?? pageNumber === 0,
    last: page.last ?? true,
  };
}

/**
 * `PUT /users/me/talent-pool/{workerId}` — ekleme idempotent bir upsert;
 * `POST` yok (`EmployerToolsController.java:77`). Not boşsa gövdeye hiç
 * konmuyor: backend `@Size(max = 1000)` dışında bir kural aramıyor ve boş
 * dize kaydedilmiş bir not gibi görünürdü.
 */
export async function saveToTalentPool(workerId: string, note: string): Promise<void> {
  const trimmed = note.trim();
  await apiRequest(`${backendPaths.talentPool}/${encodeURIComponent(workerId)}`, {
    method: "PUT",
    body: trimmed ? { note: trimmed } : {},
  });
}

/** `DELETE /users/me/talent-pool/{workerId}`; havuzda olmayan kayıt sessiz geçer. */
export async function removeFromTalentPool(workerId: string): Promise<void> {
  await apiRequest(`${backendPaths.talentPool}/${encodeURIComponent(workerId)}`, {
    method: "DELETE",
  });
}

/**
 * Kabul edilmiş adayların atamaları, işçi kimliğine göre.
 *
 * İki yol var ve hangisinin açık olduğunu başvuru satırı söylüyor:
 *
 * 1. **Doğrudan** — kabul edilmiş her başvuru `assignmentId` taşıyorsa
 *    (is-koala/koala-backend#282) her atama `GET /job-assignments/{id}` ile
 *    tek tek okunuyor; uç tarafı denetliyor ve `messagingAvailable` kararını
 *    satırda taşıyor. Kabul edilmiş aday yoksa hiç tur atılmıyor.
 * 2. **Tarama** — alan gelmiyorsa (#282 öncesi) işverenin bütün atamaları
 *    sayfalanıp ilan kimliğiyle eleniyor: `GET /users/me/assignments?asEmployer=true`
 *    ilana göre süzülemiyor (aynı sınırla: `readAllEmployerAssignments` en
 *    çok 100 sayfa). Aynı işçi için birden çok atama varsa — iptal edilip
 *    yeniden kabul edilen aday — en son kurulan kazanıyor: eski atamanın
 *    `CLOSED` kararı yeni atamanın kapısını anlatmıyor. Sıralama ucun
 *    varsayılanına bırakılmıyor (`sort` belgede boş), `assignmentDateTime`
 *    karşılaştırılıyor.
 *
 * Ayrım "hepsi" üzerinden: kabul edilmiş adaylardan biri bile kimliksizse
 * tarama yolu; yarım bir doğrudan okuma o adayın mesaj kapısını sessizce
 * kapatırdı.
 */
export async function readApplicantAssignments(
  jobId: string,
  applicants: readonly JobApplicant[],
): Promise<ReadonlyMap<string, ApplicantAssignment>> {
  const accepted = applicants.filter((applicant) => applicant.status === "ACCEPTED");
  if (accepted.length === 0) return new Map();

  if (accepted.every((applicant) => applicant.assignmentId !== null)) {
    const rows = await Promise.all(
      accepted.map((applicant) => readAssignmentRow(applicant.assignmentId as string)),
    );
    return new Map(
      rows.flatMap((row, index) => {
        const workerId = accepted[index].applicant.id;
        return row === null || !workerId
          ? []
          : [[workerId, { workerId, assignmentId: row.id, messaging: row.messaging }] as const];
      }),
    );
  }

  const { assignments } = await readAllEmployerAssignments();
  const latest = new Map<string, { assignedAt: number; entry: ApplicantAssignment }>();
  for (const assignment of assignments) {
    if (assignment.jobId !== jobId || !assignment.workerId || !assignment.id) continue;
    const assignedAt = Date.parse(assignment.assignedAt ?? "") || 0;
    const current = latest.get(assignment.workerId);
    if (current && current.assignedAt >= assignedAt) continue;
    latest.set(assignment.workerId, {
      assignedAt,
      entry: {
        workerId: assignment.workerId,
        assignmentId: assignment.id,
        messaging: assignment.messaging,
      },
    });
  }
  return new Map([...latest].map(([workerId, { entry }]) => [workerId, entry]));
}

/**
 * `GET /job-assignments/{id}` — yalnız mesaj kapısı için okunan dar satır.
 *
 * Taraf olmayan çağırana 404 dönüyor; bu ekranda 404 "atama artık yok" demek
 * ve kartın mesaj düğmesi çizilmiyor, sayfa düşmüyor. Öbür hatalar çağırana
 * çıkıyor.
 */
async function readAssignmentRow(
  assignmentId: string,
): Promise<{ id: string; messaging: MessagingAvailability | null } | null> {
  try {
    const dto = await apiRequest<{
      id?: string | null;
      messagingAvailable?: boolean | null;
      messagingAvailableReason?: string | null;
    } | null>(`${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}`, {
      cache: "no-store",
    });
    if (dto === null) return null;
    return { id: dto.id ?? assignmentId, messaging: messagingAvailabilityFrom(dto) };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === notFoundStatus) return null;
    throw error;
  }
}

/**
 * `POST /jobs/{jobId}/conversation?workerId=` — var olan konuşmayı da aynı
 * yanıtla döndürüyor, yani ikinci çağrı yeni kayıt açmıyor.
 *
 * `workerId` zorunlu gönderiliyor: parametre verilmediğinde backend çağıranı
 * işçi sayıyor (`MessagingManager.java:91`) ve işveren kendisiyle bir konuşma
 * açardı.
 */
export async function openApplicantConversation(
  jobId: string,
  workerId: string,
): Promise<string> {
  const conversation = await apiRequest<{ id?: string | null } | null>(
    `${backendPaths.jobs}/${encodeURIComponent(jobId)}/conversation?workerId=${encodeURIComponent(workerId)}`,
    { method: "POST" },
  );
  const id = conversation?.id;
  if (!id) throw new Error("Conversation response is missing an identifier");
  return id;
}

/**
 * `POST /job-applications/{applicationId}/respond` — kabul ya da red.
 *
 * Yol `backendPaths` içinde değil, komşusu `withdrawWorkerApplication` gibi
 * burada yazılı: `/job-applications` bu iki çağrı dışında hiçbir yerden
 * okunmuyor.
 *
 * Kabul **geri alınamaz** ve tek bir çağrının üç yan etkisi var
 * (`JobApplicationManager.respondToApplication`): `PENDING_CONFIRMATION`
 * durumunda bir `JobAssignment` kuruluyor, ilanın donmuş fiyatı atamaya
 * kopyalanıyor, işçiye teklif bildirimi gidiyor — ve atama kurulduğu an
 * ADR-0003 uyarınca tam iş adresi işçiye açılıyor. Ekran bunu karar anında
 * söylemek zorunda; sonradan öğrenmek geri alınamaz bir ifşa demek.
 *
 * `rejectionReason` yalnız redde gövdeye giriyor. Sunucu alanı kabulde hiç
 * okumuyor ve kabul edilen bir başvuruda saklanmış bir red gerekçesi kaydı
 * kirletirdi.
 */
export async function respondToApplication(input: {
  applicationId: string;
  decision: ApplicationDecision;
  rejectionReason: string;
}): Promise<ApplicationDecisionOutcome> {
  const detail = await apiRequest<ApplicationDecisionDto | null>(
    `/job-applications/${encodeURIComponent(input.applicationId)}/respond`,
    {
      method: "POST",
      body:
        input.decision === "REJECTED"
          ? { status: input.decision, rejectionReason: input.rejectionReason.trim() }
          : { status: input.decision },
    },
  );

  /*
    Atama kimliği yalnız bu yanıtta var: başvuru listesi ucu (`JobApplicantDto`)
    onu taşımıyor, yani karar anında okunmazsa bu ekrandan bir daha okunamıyor.
    Yanıtın kararı kendi alanından geri alınıyor ve gönderilen değer
    varsayılmıyor — sunucu son sözü söyleyen taraf.

    Üç dal var, iki değil. Tanınmayan ya da eksik bir `status` kabule
    **düşürülmüyor**: kabul dalı ekranda "tam iş adresi ona açıldı" yazıyor ve
    atama bağlantısı çiziyor, yani okunamayan bir durumu kabul saymak geri
    alınamaz bir ifşanın olduğunu iddia etmek olurdu. Ekran adres gizliliği
    hakkında yanlış konuşamaz; `UNKNOWN` yenilemeyi söylüyor.
    `APPLIED`/`WITHDRAWN` de buraya düşüyor: ikisi de bir karar değil.
  */
  const status = known<ApplicationStatus>(detail?.status, applicationStatuses);
  return {
    decision: status === "ACCEPTED" || status === "REJECTED" ? status : "UNKNOWN",
    assignmentId: clean(detail?.assignment?.id),
    messaging: detail?.assignment ? messagingAvailabilityFrom(detail.assignment) : null,
  };
}

function toJobApplicant(dto: JobApplicantDto): JobApplicant {
  const assignmentId = clean(dto.assignmentId);
  return {
    id: dto.id ?? "",
    status: applicationStatuses.has(dto.status as ApplicationStatus)
      ? (dto.status as ApplicationStatus)
      : "UNKNOWN",
    appliedAt: dto.applicationDateTime ?? "",
    answeredAt: clean(dto.answeredDateTime),
    rejectionReason: clean(dto.rejectionReason),
    // Kimlik yola giriyor (`GET /job-assignments/{id}`); UUID değilse yok sayılır.
    assignmentId: assignmentId !== null && isUuid(assignmentId) ? assignmentId : null,
    notes: clean(dto.notes),
    cvUrl: clean(dto.cvUrl),
    occupation: clean(dto.jobTitle),
    applicant: {
      id: dto.applicant?.id ?? "",
      fullName: displayName(dto.applicant),
      profilePictureUrl: clean(dto.applicant?.profilePictureUrl),
    },
  };
}

function toApplicantProfile(
  userId: string,
  dto: PublicProfileDto | null,
): ApplicantProfile {
  return {
    id: dto?.id ?? userId,
    fullName: displayName(dto),
    profilePictureUrl: clean(dto?.profilePictureUrl),
    occupation: clean(dto?.jobTitle),
    about: clean(dto?.about),
    cityName: clean(dto?.cityName),
    districtName: clean(dto?.districtName),
    cvUrl: clean(dto?.cvUrl),
  };
}

/**
 * Ortalama puan **dize** olarak taşınıyor.
 *
 * Backend `BigDecimal` gönderiyor; sayıya çevirip yeniden yazmak yuvarlamayı
 * istemcide tekrar üretmek olurdu. Ekran onu olduğu gibi basıyor.
 */
function toRatingSummary(dto: RatingSummaryDto | null): ApplicantRatingSummary | null {
  if (dto === null || dto === undefined) return null;
  return {
    reviewCount: dto.reviewCount ?? 0,
    averageRating: dto.averageRating === null || dto.averageRating === undefined
      ? ""
      : String(dto.averageRating),
  };
}

/**
 * Anonim değerlendirmede `author` backend'de zaten `null`; ad alanı da burada
 * boş kalır ve ekran "Anonim" yazar. Kimliği istemcide gizlemek, veriyi
 * yanıtta taşımaya devam etmek olurdu.
 */
function toApplicantReview(dto: ReviewDto): ApplicantReview {
  const authorName = dto.author ? displayName(dto.author) : "";
  return {
    id: dto.id ?? "",
    authorName: authorName || null,
    rating: dto.rating ?? 0,
    comment: clean(dto.comment),
    createdAt: dto.createdAt ?? "",
  };
}

/** Adı olmayan rozet ekranda boş bir çip olurdu; kod yedeğe düşüyor. */
function toApplicantBadge(dto: BadgeDto): ApplicantBadge {
  const code = dto.code?.trim() ?? "";
  return {
    code,
    name: dto.name?.trim() || code,
    tier: badgeTiers.has(dto.tier as BadgeTier) ? (dto.tier as BadgeTier) : "UNKNOWN",
  };
}

function toTalentPoolEntry(dto: TalentPoolEntryDto): TalentPoolEntry {
  return {
    id: dto.id ?? "",
    workerId: dto.worker?.id ?? "",
    fullName: displayName(dto.worker),
    profilePictureUrl: clean(dto.worker?.profilePictureUrl),
    note: clean(dto.note),
    createdAt: dto.createdAt ?? "",
  };
}

/** Ad soyad boşsa kullanıcı adına düşer; ekranda hiç boş kart kalmaz. */
function displayName(user: SafeUserDto | null | undefined): string {
  const name = [user?.firstName, user?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return name || user?.username?.trim() || "";
}

function emptyTalentPool(pageNumber: number): TalentPoolPage {
  return emptyBackendPage<TalentPoolEntry>(pageNumber, talentPoolPageSize);
}
