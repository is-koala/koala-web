import type { WorkSession } from "@/assignments/work-detail";

/**
 * İşverenin atama takibi: tamamlama kararı, sıradaki adım ve zaman çizelgesi.
 *
 * Kuralı sunucu koyuyor ve burada **tekrar edilmiyor, yansıtılıyor**.
 * `JobAssignmentManager.completeAssignment` (`:452-482`) iki koşul arıyor ve
 * ikisi de atama satırından okunabiliyor:
 *
 * 1. `paymentStatus == HELD_IN_ESCROW`, yoksa 409 `ASSIGNMENT_PAYMENT_NOT_SECURED`
 * 2. `status ∈ {CONFIRMED, IN_PROGRESS}`, yoksa 409 `JOB_ASSIGNMENT_NOT_COMPLETABLE`
 *
 * İkisi de önden okunabildiği için düğme mümkün olmayan bir eylemi hiç
 * göstermiyor; kapalıyken de nedeni yanında yazılı kalıyor.
 *
 * `server-only` yok: hem sunucu sayfası hem istemci bileşeni aynı tabloyu
 * okuyor, içinde ağ çağrısı ya da gizli değer taşımıyor.
 */

/** Tamamlama düğmesinin ekrandaki tam hâli. */
export type CompletionDecision = {
  readonly available: boolean;
  /** Eylem kapalıysa nedeni; açıkken `null`. */
  readonly blockedReason: string | null;
};

/** Sunucunun tamamlamaya izin verdiği iki durum. */
const completableStatuses = new Set(["CONFIRMED", "IN_PROGRESS"]);

/**
 * Durum reddi neden **önce** okunuyor?
 *
 * Sunucu sırayla önce ödemeye bakıyor, ama iptal edilmiş bir atamada
 * "ödeme emanette değil" demek doğruyu söyleyip yanlış yere bakmak olurdu:
 * ödeme iade edilmiş ve engel iptalin kendisi. Düğmenin açık/kapalı olması
 * iki sırada da aynı — ayrılan tek şey kullanıcının okuduğu neden.
 */
const statusReasons: Readonly<Record<string, string>> = {
  PENDING_CONFIRMATION: "İşçi atamayı onaylamadan iş tamamlandı olarak işaretlenemez.",
  COMPLETED: "Bu atama zaten tamamlandı olarak işaretlendi.",
  CANCELLED: "İptal edilmiş bir atama tamamlanamaz.",
  REJECTED: "İşçi bu atamayı reddetti; tamamlanacak bir iş yok.",
};

const unknownStatusReason = "Bu atamanın durumu okunamadığı için işlem yapılamıyor.";

const escrowReason =
  "Ödeme emanete alınmadan iş tamamlandı olarak işaretlenemez; önce ödemeyi tamamla.";

export function assignmentCompletion(input: {
  assignmentStatus: string;
  paymentStatus: string;
}): CompletionDecision {
  const statusReason = statusReasons[input.assignmentStatus];
  if (statusReason) return { available: false, blockedReason: statusReason };

  // Tanınmayan durumda geri alınamaz bir düğme çizmek, kullanıcıya ne
  // yaptığını okuyamadığı bir eylem sunmak olurdu.
  if (!completableStatuses.has(input.assignmentStatus)) {
    return { available: false, blockedReason: unknownStatusReason };
  }

  if (input.paymentStatus !== "HELD_IN_ESCROW") {
    return { available: false, blockedReason: escrowReason };
  }

  return { available: true, blockedReason: null };
}

/**
 * Atamanın sıradaki adımı.
 *
 * Hem liste hem ayrıntı bunu okuyor: `PENDING_CONFIRMATION` ile `CONFIRMED`
 * rozetle ayrılıyor ama ayrımın **anlamı** burada yazılı — ödeme yalnız
 * `CONFIRMED` iken açılabiliyor (`PaymentStateMachine.java:16-19`), yani iki
 * satır aynı görünse de kullanıcının yapacağı iş farklı.
 */
export function assignmentNextStep(assignmentStatus: string, paymentStatus: string): string {
  if (assignmentStatus === "REJECTED") return "İşçi teklifi reddetti; yeni bir aday seçebilirsin.";
  if (assignmentStatus === "CANCELLED") return "Atama iptal edildi.";
  if (paymentStatus === "RELEASED_TO_WORKER") return "Para işçiye aktarıldı.";
  if (paymentStatus === "REFUNDED") return "Ödeme iade sürecinde.";
  if (paymentStatus === "PENDING_COLLECTION" || paymentStatus === "FAILED") {
    return assignmentStatus === "CONFIRMED"
      ? "Ödemeyi güvenli ödeme sayfasından tamamla."
      : "Şimdilik işçinin atamayı onaylamasını bekle.";
  }
  if (assignmentStatus === "COMPLETED") return "Para işçiye aktarılmak üzere işleniyor.";
  if (assignmentStatus === "CONFIRMED" || assignmentStatus === "IN_PROGRESS") {
    return "İş bittiğinde atamayı tamamlandı olarak işaretle.";
  }
  return "Şimdilik işçinin girişini bekle.";
}

/**
 * Tamamlama eyleminin durumu.
 *
 * Başarıda bir yük taşımıyor: sayfa `revalidatePath` ile yeniden çiziliyor ve
 * güncel atama tek doğru kaynak orası.
 */
export type CompletionActionState =
  | { readonly status: "idle" }
  | { readonly status: "done" }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleCompletionActionState: CompletionActionState = { status: "idle" };

export type CompletionAction = (
  state: CompletionActionState,
  formData: FormData,
) => Promise<CompletionActionState>;

/** Çizelgedeki tek bir adım. */
export type TrackingEvent = {
  readonly key: string;
  readonly label: string;
  /** Backend bu adım için bir zaman taşımıyorsa `null`; adım yine de çizilir. */
  readonly at: string | null;
  /** Gerçekleşti mi; beklenen ama henüz olmamış adım `false`. */
  readonly reached: boolean;
};

const startedStatuses = new Set(["IN_PROGRESS", "COMPLETED"]);
const confirmedStatuses = new Set(["CONFIRMED", "IN_PROGRESS", "COMPLETED"]);

/**
 * `PENDING_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETED` yolu ve iki
 * çıkışı.
 *
 * Red ve iptal aşamaları **kısaltıyor**, işaretlemiyor: reddedilmiş bir
 * atamada "iş başladı" adımını beklemede göstermek, hiç olmayacak bir adımı
 * bekletirdi. İptal ise geriye dönmüyor — o ana kadar gerçekleşen aşamalar
 * duruyor ve iptal son adım oluyor.
 *
 * `CONFIRMED` adımının zamanı yok, bilerek: backend onay anını ayrı bir alanda
 * taşımıyor ve uydurulmuş bir zaman, olmayan bir kaydı varmış gibi gösterirdi.
 */
export function employerAssignmentTimeline(input: {
  status: string;
  assignedAt: string | null;
  completedAt: string | null;
  sessions: readonly WorkSession[];
}): readonly TrackingEvent[] {
  const started = startedStatuses.has(input.status) || input.sessions.length > 0;
  const confirmed = confirmedStatuses.has(input.status) || started;
  const firstCheckIn = input.sessions.at(0)?.checkInAt ?? null;

  const offered: TrackingEvent = {
    key: "offered",
    label: "Teklif işçiye gönderildi",
    at: input.assignedAt,
    reached: true,
  };

  if (input.status === "REJECTED") {
    return [offered, { key: "rejected", label: "İşçi teklifi reddetti", at: null, reached: true }];
  }

  const stages: TrackingEvent[] = [
    offered,
    { key: "confirmed", label: "İşçi atamayı onayladı", at: null, reached: confirmed },
    { key: "started", label: "İş başladı", at: firstCheckIn, reached: started },
  ];

  if (input.status === "CANCELLED") {
    return [...stages, { key: "cancelled", label: "Atama iptal edildi", at: null, reached: true }];
  }

  return [
    ...stages,
    {
      key: "completed",
      label: "İş tamamlandı olarak işaretlendi",
      at: input.completedAt,
      reached: input.status === "COMPLETED",
    },
  ];
}
