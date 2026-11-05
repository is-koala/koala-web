import type { WorkerAssignment } from "@/assignments/contract";
import type { WorkerAssignmentResolution } from "@/assignments/resolution";
import type { AssignmentReviewState } from "@/assignments/review";
import type { TransitDirections } from "@/assignments/transit-directions";
import type { MessagingAvailability } from "@/messaging/contract";
import type { AssignmentTransport } from "@/transport/contract";

export type { CancellationPreview } from "@/assignments/resolution";

export type WorkAssignment = WorkerAssignment & AssignmentReviewState & {
  completedAt: string | null;
  /**
   * Çizelgenin başvuru → kabul → onay → ödeme adımları. Dördü de backend'in
   * `MyAssignmentDto`'suna is-koala/koala-backend#282 ile giriyor; alan
   * gelmediyse `null` ve satır **çizilmiyor** — uydurulmuş bir zaman, olmayan
   * bir kaydı varmış gibi gösterirdi. `paymentSecuredAt` bugün de dolabiliyor:
   * atamanın ödeme denemelerinden ilk başarılı olanın `completedAt`'i.
   */
  appliedAt: string | null;
  acceptedAt: string | null;
  confirmedAt: string | null;
  paymentSecuredAt: string | null;
  /**
   * `messagingAvailable` + `messagingAvailableReason`; alan yoksa `null` ve
   * ekran mesaj düğmesini hiç çizmez (`MessagingGate`). Liste modeline
   * (`WorkerAssignment`) girmiyor: düğme yalnız ayrıntıda.
   */
  messaging: MessagingAvailability | null;
};

/**
 * İşveren kartı. Şirket ilanında şirket adı/logo/web sitesi, bireysel ilanda
 * ilanı açan kişinin adı ve fotoğrafı. Backend'in kullanıcı nesnesi bu sınırı
 * geçmiyor: kimlik, e-posta, telefon burada yok.
 */
export type WorkEmployer = {
  kind: "company" | "person";
  name: string;
  imageUrl: string | null;
  /** Yalnız şirkette ve yalnız `safeExternalUrl` kapısından geçtiyse. */
  website: string | null;
};

export type WorkSession = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  minutes: number | null;
};

/**
 * İş ayrıntısı ekranının tarayıcıya açtığı dar, serileştirilebilir görünüm.
 * Konum koordinatları ve backend'in kullanıcı/iş nesneleri bu sınırı geçmez.
 */
export type WorkDetail = {
  /** İlk sayaç metnini SSR ve hydration'da aynı tutan sunucu gözlem zamanı. */
  observedAt: number;
  assignment: WorkAssignment;
  employer: WorkEmployer | null;
  description: string | null;
  duties: string | null;
  dressCode: string | null;
  fullAddress: string | null;
  /** Adres tarifi; `fullAddress` ile aynı kesinlik kapısından geçer (EXACT). */
  additionalDirections: string | null;
  /**
   * Toplu taşımayla yol tarifi bağlantıları; yalnız kesin adresli etkin
   * atamada (is-koala/koala-web#178). Koordinat bağlantının içinde.
   */
  directions: TransitDirections | null;
  /** `null` sınırsız kontenjan; `hiredCount` kalan yerin üst sınırı (`openings`). */
  headcount: number | null;
  hiredCount: number;
  /** İlanın yayımlanma anı. */
  createdAt: string | null;
  sessions: readonly WorkSession[];
  resolution: WorkerAssignmentResolution;
  /**
   * Ulaşım planı ve bu atamanın koltukları (`GET /job-assignments/{id}/transport`,
   * backend 0.9.28). Plaka/şoför yalnız koltuk seçilen serviste dolu — kararı
   * sunucu veriyor. Planı olmayan ilanda ve eski sunucuda `null`; kart
   * çizilmiyor (is-koala/koala-web#187).
   */
  transport: AssignmentTransport | null;
};

export type CheckpointKind = "check-in" | "check-out";

export type WorkDetailCommand =
  | { type: "refresh" }
  | {
      type: "checkpoint";
      kind: CheckpointKind;
      point: { latitude: number; longitude: number } | null;
    }
  | { type: "cancel"; reason: string }
  | { type: "dispute"; reason: string; evidence?: readonly File[] }
  | { type: "evidence"; disputeId: string; evidence: readonly File[] }
  | { type: "review"; rating: number; comment: string }
  /** Koltuk seçimi; yön servisin yönünden türüyor ve o yöndeki seçimin yerine geçiyor. */
  | { type: "seat"; shuttleId: string; stopId: string };

export type WorkDetailActionResult =
  | {
      status: "done";
      detail: WorkDetail;
      feedback?: { kind: "notice" | "warning"; message: string };
    }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      detail?: WorkDetail | null;
    };

export type WorkDetailAction = (
  command: WorkDetailCommand,
) => Promise<WorkDetailActionResult>;
