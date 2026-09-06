/**
 * İlanın durum geçişleri.
 *
 * Kuralı sunucu koyuyor ve burada **tekrar edilmiyor, yansıtılıyor**:
 * `JobManager.closeJob` yalnız `OPEN` durumundan geçiyor (`:446-456`),
 * `JobManager.cancelJob` ise `CANCELLED` ve `COMPLETED` dışındaki her
 * durumdan (`:388-402`). Ekranın işi bu iki satırı okunur hâle getirmek;
 * mümkün olmayan bir geçişi düğme olarak gösterip 409 yemek değil.
 *
 * `server-only` yok, bilerek: hem sayfa hem istemci bileşeni aynı tabloyu
 * okuyor. İçinde ağ çağrısı ya da gizli değer taşımıyor.
 */

/** `JobStatus`; backend enum'unun beş değeri. */
export type JobStatus = "OPEN" | "CLOSED" | "IN_PROGRESS" | "CANCELLED" | "COMPLETED";

export type JobLifecycleOperation = "close" | "cancel";

/**
 * Bir eylemin ekrandaki tam hâli.
 *
 * `available` ile `blockedReason` birlikte taşınıyor: kapalı bir eylemi
 * sebepsiz gizlemek, kullanıcıya ilanın neden yönetilemediğini hiç
 * söylememek olurdu.
 */
export type JobAction = {
  readonly operation: JobLifecycleOperation;
  readonly label: string;
  /** Onaydan önce okunan sonuç; eylem geri alınamaz olduğunda bunu yazar. */
  readonly consequence: string;
  readonly available: boolean;
  /** Eylem kapalıysa nedeni; açıkken `null`. */
  readonly blockedReason: string | null;
};

/** `useActionState` ile paylaşılan durum; backend'in ham metni taşınmaz. */
export type JobLifecycleState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly operation: JobLifecycleOperation }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleJobLifecycleState: JobLifecycleState = { status: "idle" };

/** Gövdeden okunan işlem adının gerçekten bir geçiş olup olmadığı. */
export function isJobLifecycleOperation(value: string): value is JobLifecycleOperation {
  return value === "close" || value === "cancel";
}

const statusLabels: Readonly<Record<JobStatus, string>> = {
  OPEN: "Yayında — başvurulara açık",
  CLOSED: "Kapatıldı — yeni başvuru alınmıyor",
  // `JobStatus` bugün yalnız `OPEN`, `CLOSED` ve `CANCELLED` değerlerine
  // yazılıyor (`JobManager.java:166,244,399,453`); `IN_PROGRESS` ve
  // `COMPLETED` enum'da duruyor ama hiçbir kod onları atamıyor. Yine de
  // etiketleri var: eksik bir etiket kullanıcıya İngilizce bir sabit
  // gösterirdi ve enum bugün sessizce kullanılmaya başlanabilir.
  IN_PROGRESS: "İş sürüyor",
  CANCELLED: "İptal edildi",
  COMPLETED: "Tamamlandı",
};

const unknownStatusLabel = "Durumu okunamadı";

const unknownStatusReason = "Bu ilanın durumu okunamadığı için işlem yapılamıyor.";

export function jobStatusLabel(status: string): string {
  return isJobStatus(status) ? statusLabels[status] : unknownStatusLabel;
}

/**
 * Bu durumdaki ilanın iki eylemi ve her birinin ekrandaki karşılığı.
 *
 * Liste hep iki maddeli: kapalı bir eylemi listeden düşürmek yerine nedenini
 * taşımak, "bu ilanda kapatma yok" ile "kapatma zaten yapılmış" arasındaki
 * farkı ekranda bırakıyor.
 *
 * Tanınmayan bir durumda ikisi de kapalı. Sunucunun iptal kuralı bir dışlama
 * listesi olduğu için tanınmayan bir durumu teknik olarak iptale açık sayardı;
 * ama etiketleyemediğimiz bir durumda geri alınamaz bir düğme çizmek,
 * kullanıcıya ne yaptığını okuyamadığı bir eylem sunmak olurdu.
 */
export function jobLifecycleActions(status: string): readonly JobAction[] {
  const known = isJobStatus(status);

  return [
    {
      operation: "close",
      label: "İlanı kapat",
      consequence:
        "Kapatılan ilan aramalarda görünmez ve yeni aday bulamaz. Gelen başvurular ile varsa atamalar olduğu gibi kalır.",
      available: known && status === "OPEN",
      blockedReason: known ? closeBlockedReason(status) : unknownStatusReason,
    },
    {
      operation: "cancel",
      label: "İlanı iptal et",
      consequence:
        "İptal edilen ilan geçersiz olur ve başvuranlara bildirim gider. Bu işlem geri alınamaz; başvuru geçmişi silinmez.",
      // Sunucunun kendi kuralı bir dışlama listesi; aynı biçimde yazılıyor ki
      // backend'e yeni bir durum eklendiğinde ekran onu sessizce kilitlemesin.
      available: known && status !== "CANCELLED" && status !== "COMPLETED",
      blockedReason: known ? cancelBlockedReason(status) : unknownStatusReason,
    },
  ];
}

function closeBlockedReason(status: JobStatus): string | null {
  if (status === "OPEN") return null;
  if (status === "CLOSED") return "Bu ilan zaten kapalı; yeniden kapatılamaz.";
  if (status === "CANCELLED") return "İptal edilmiş bir ilan kapatılamaz.";
  if (status === "COMPLETED") return "Tamamlanmış bir ilan kapatılamaz.";
  return "İşi süren bir ilan kapatılamaz.";
}

function cancelBlockedReason(status: JobStatus): string | null {
  if (status === "CANCELLED") return "Bu ilan zaten iptal edildi.";
  if (status === "COMPLETED") return "Tamamlanmış bir ilan iptal edilemez.";
  return null;
}

/**
 * Bu ilanın başvuru yüzeyi neden kapalı; açıksa `null`.
 *
 * Kural burada yaşıyor çünkü backend'de **yok**: `JobApplicationManager`
 * başvuru alırken ilanın durumuna hiç bakmıyor, yani kapatılmış bir ilana
 * doğrudan bağlantıyla gelen kişi API'den hâlâ başvurabiliyor. Arama
 * kapatılmış ilanı zaten göstermiyor (`JobManager.search` yalnız `OPEN`
 * arıyor), ama paylaşılmış bir bağlantı o filtrenin dışından geliyor.
 *
 * Tanınmayan bir durum **kapalı sayılmıyor**: alan yanıttan hiç gelmezse
 * `UNKNOWN` oluyor ve bilinmeyeni kapalı saymak, tek bir sözleşme
 * değişikliğinde her ilanın başvuru formunu sessizce kaldırırdı. Karar yalnız
 * sunucunun açıkça söylediği durumlardan çıkar.
 */
export function jobApplicationsClosedReason(status: string): string | null {
  return isJobStatus(status) ? (applicationsClosedReasons[status] ?? null) : null;
}

const applicationsClosedReasons: Readonly<Partial<Record<JobStatus, string>>> = {
  CLOSED: "Bu ilan kapatıldı ve yeni başvuru almıyor.",
  CANCELLED: "Bu ilan iptal edildi ve yeni başvuru almıyor.",
  COMPLETED: "Bu ilan tamamlandı ve yeni başvuru almıyor.",
  IN_PROGRESS: "Bu ilanın işi başladı; yeni başvuru alınmıyor.",
};

/** `known()` yardımcısının tanıdığı değerler; sözleşme tek yerden okunur. */
export const jobStatuses: ReadonlySet<JobStatus> = new Set(
  Object.keys(statusLabels) as JobStatus[],
);

function isJobStatus(status: string): status is JobStatus {
  return Object.hasOwn(statusLabels, status);
}
