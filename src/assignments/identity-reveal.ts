import type { AssignmentStatus } from "@/assignments/contract";

/**
 * İşverenin sigorta bildirimi için işçinin kimliğini görüntülemesi
 * (is-koala/koala-web#185, backend 0.9.27 `GET /job-assignments/{id}/worker-identity`).
 *
 * `server-only` yok: sunucu action'ı yanıtı bu modele daraltırken, istemci
 * bileşeni aynı modeli çiziyor ve aynı durum kapısını okuyor. Model bilerek
 * dar — backend `WorkerIdentityDto`'nun beş alanı, fazlası yok.
 */

export const verificationMethods = ["CHIP", "DOCUMENT"] as const;

export type VerificationMethod = (typeof verificationMethods)[number] | "UNKNOWN";

export type WorkerIdentity = {
  readonly fullName: string;
  readonly tcIdentityNumber: string;
  /** Backend `LocalDate`, "1990-05-17" biçiminde; an değil, gün. */
  readonly birthDate: string | null;
  /** Backend `Instant`; ekran "2 Eyl 2026 13:15" yazar. */
  readonly verifiedAt: string | null;
  readonly verificationMethod: VerificationMethod;
};

/**
 * Backend `IdentityRevealManager`: yalnız işe alınmış atama
 * (`AssignmentStatus.HIRED` = CONFIRMED, IN_PROGRESS, COMPLETED); başkasında
 * 404. Düğme bu kümenin dışında hiç çizilmiyor — "404 → düğme yok" kararı
 * sunucunun, ekran onu satırın durumundan okuyor.
 */
export function canRevealWorkerIdentity(status: AssignmentStatus): boolean {
  return status === "CONFIRMED" || status === "IN_PROGRESS" || status === "COMPLETED";
}

/**
 * Alanların ekranda maskesiz kaldığı süre.
 *
 * Süre istemcide sayılıyor: backend her okumayı kayda geçiriyor ve işçiye
 * bildiriyor, yani "yeniden göster" yeni bir okuma ve yeni bir bildirim.
 * Zamanlayıcı ekran kapanınca temizleniyor; değer hiçbir yere yazılmıyor.
 */
export const identityRevealVisibleMs = 60_000;

export type IdentityRevealState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly identity: WorkerIdentity }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export const idleIdentityRevealState: IdentityRevealState = { status: "idle" };

export type IdentityRevealAction = (
  state: IdentityRevealState,
  formData: FormData,
) => Promise<IdentityRevealState>;

export function verificationMethodLabel(method: VerificationMethod): string {
  switch (method) {
    case "CHIP":
      return "Çipli kimlik kartı (NFC)";
    case "DOCUMENT":
      return "Kimlik belgesi fotoğrafı";
    default:
      return "Doğrulandı";
  }
}

/**
 * Süre dolunca alanların yerine yazılan metin.
 *
 * Değerin bir parçası bile kalmıyor: maskeli hâl gerçek değerden türetilmiyor,
 * sabit. Alan boş da bırakılmıyor ki kullanıcı bilginin orada olduğunu ve
 * yeniden istenebileceğini görsün.
 */
export const maskedIdentityValue = "•••••••••••";
