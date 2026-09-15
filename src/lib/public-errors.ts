import { backendErrorFamilies, type BackendErrorFamily } from "./backend-error-codes";
import {
  notFoundErrorPresentation,
  unexpectedErrorPresentation,
  type ErrorCatalog,
  type ErrorPresentation,
} from "./error-presentation";

export type {
  ErrorAction,
  ErrorCatalog,
  ErrorPresentation,
  ErrorRecoveryAction,
} from "./error-presentation";
export { errorRecoveryAction } from "./error-presentation";

/**
 * Herkese açık yüzeylerin hata kataloğu.
 *
 * Bu dosya ilan ayrıntısının istemci paketine giriyor (`JobApplicationForm`
 * → `PublicFormAlert`) ve o rota 256.000 baytlık betik bütçesinin sınırında
 * (`docs/performance-accessibility-budget.md`, is-koala/koala-web#177). Bu
 * yüzden buraya yalnız oturumsuz ya da oturum açar açmaz karşılaşılan
 * kodlar yazılır: oturum, giriş, kayıt, başvuru ve genel red aileleri. Ödeme,
 * şirket, mesajlaşma, uyuşmazlık ve ilan yönetimi metinleri alan
 * modüllerinde (`src/payments/errors.ts` gibi) durur ve `@/lib/errors`
 * onları yalnız oturumlu kabuk için birleştirir. Buraya cümle eklemeden önce
 * bütçeyi yeniden ölç.
 */

export const publicErrors: ErrorCatalog = {
  AUTHENTICATION_REQUIRED: {
    title: "Oturum açman gerekiyor",
    message: "Bu işlemi sürdürmek için giriş yap.",
    action: "login",
  },
  INVALID_CREDENTIALS: {
    title: "Giriş bilgileri uyuşmuyor",
    message: "E-posta adresini ve parolanı kontrol ederek yeniden dene.",
    action: "none",
  },
  AUTH_EMAIL_OR_PASSWORD_MISMATCH: {
    title: "Giriş bilgileri uyuşmuyor",
    message: "E-posta adresini ve parolanı kontrol ederek yeniden dene.",
    action: "none",
  },
  TOKEN_EXPIRED: {
    title: "Oturumun sona erdi",
    message: "Devam etmek için yeniden giriş yap.",
    action: "login",
  },
  AUTH_REFRESH_TOKEN_EXPIRED: {
    title: "Oturumun sona erdi",
    message: "Devam etmek için yeniden giriş yap.",
    action: "login",
  },
  APPLICANT_IDENTITY_NOT_VERIFIED: {
    title: "Kimliğini doğrulaman gerekiyor",
    message: "Başvuru yapmadan önce dört kimlik fotoğrafını yüklemelisin.",
    action: "none",
  },
  APPLICANT_ADDRESS_REQUIRED: {
    title: "Adresini eklemen gerekiyor",
    message: "Başvuru yapmadan önce hesabına bir adres eklemelisin.",
    action: "none",
  },
  APPLICANT_BANK_ACCOUNT_REQUIRED: {
    title: "Ödeme hesabını eklemen gerekiyor",
    message: "Kazancının aktarılabilmesi için bir ödeme hesabı eklemelisin.",
    action: "none",
  },
  JOB_APPLICATION_USER_CANNOT_APPLY_TO_OWN_JOB: {
    title: "Kendi ilanına başvuramazsın",
    message: "Yayınladığın bir ilana çalışan olarak başvuru yapılamıyor.",
    action: "none",
  },
  JOB_APPLICATION_CONTACT_USER_CANNOT_APPLY_TO_COMPANY_JOB: {
    title: "Şirketinin ilanına başvuramazsın",
    message: "Yetkilisi olduğun şirketin ilanına çalışan olarak başvuru yapılamıyor.",
    action: "none",
  },
  JOB_APPLICATION_USER_ALREADY_APPLIED_TO_JOB: {
    title: "Bu ilana zaten başvurdun",
    message: "Başvurunun güncel durumunu Başvurularım sayfasından takip edebilirsin.",
    action: "none",
  },
  AUTH_REGISTRATION_TOKEN_EXPIRED: {
    title: "Bağlantının süresi dolmuş",
    message: "Yeni bir kayıt bağlantısı isteyerek yeniden deneyebilirsin.",
    action: "none",
  },
  ACCESS_DENIED: {
    title: "Bu işlem için yetkin yok",
    message: "Farklı bir hesapla giriş yapabilir veya ana sayfaya dönebilirsin.",
    action: "home",
  },
  TOO_MANY_REQUESTS: {
    title: "Çok fazla deneme yaptın",
    message: "Kısa bir süre bekleyip yeniden dene.",
    action: "retry",
  },
  AUTH_TOO_MANY_REQUESTS: {
    title: "Çok fazla deneme yaptın",
    message: "Kısa bir süre bekleyip yeniden dene.",
    action: "retry",
  },
  UPGRADE_REQUIRED: {
    title: "Sayfayı yenilemen gerekiyor",
    message: "Koala'nın güncel sürümünü kullanmak için sayfayı yenile.",
    action: "retry",
  },
};

const familyErrors: Record<BackendErrorFamily, ErrorPresentation> = {
  authentication: {
    title: "Oturum açman gerekiyor",
    message: "Bu işlemi sürdürmek için yeniden giriş yap.",
    action: "login",
  },
  conflict: {
    title: "İşlem tamamlanamadı",
    message: "Bu kayıt başka bir duruma geçmiş olabilir. Sayfayı yenileyip yeniden dene.",
    action: "retry",
  },
  external: {
    title: "Hizmete ulaşılamıyor",
    message: "Bağlı hizmet şu anda yanıt vermiyor. Biraz sonra yeniden dene.",
    action: "retry",
  },
  forbidden: {
    title: "Bu işlem için yetkin yok",
    message: "Farklı bir hesapla giriş yapabilir veya ana sayfaya dönebilirsin.",
    action: "home",
  },
  notFound: {
    title: "İçerik bulunamadı",
    message: "Aradığın kayıt artık mevcut olmayabilir.",
    action: "home",
  },
  rateLimited: {
    title: "Çok fazla deneme yaptın",
    message: "Kısa bir süre bekleyip yeniden dene.",
    action: "retry",
  },
  validation: {
    title: "Bilgileri kontrol et",
    message: "Gönderdiğin bilgilerden bazıları geçerli değil.",
    action: "none",
  },
};

/**
 * Bir kataloğa göre sunum: önce kodun kendi cümlesi, sonra backend ailesi,
 * sonra HTTP durumu. Sıra `errorCode` önceliğini kuruyor — dallanma mesaj
 * metniyle ya da durum koduyla değil, kodla yapılır (AGENTS.md).
 */
export function catalogErrorPresentation(
  catalog: ErrorCatalog,
  errorCode: string | null | undefined,
  status: number,
): ErrorPresentation {
  if (errorCode && catalog[errorCode]) return catalog[errorCode];
  if (errorCode && backendErrorFamilies[errorCode]) {
    return familyErrors[backendErrorFamilies[errorCode]];
  }
  if (status === 401) return publicErrors.AUTHENTICATION_REQUIRED;
  if (status === 403) return publicErrors.ACCESS_DENIED;
  if (status === 404) return notFoundErrorPresentation;
  return unexpectedErrorPresentation;
}

/** Herkese açık yüzeylerin sunumu; kabuk `@/lib/errors` içindeki tam kataloğu okur. */
export function publicErrorPresentation(
  errorCode: string | null | undefined,
  status: number,
): ErrorPresentation {
  return catalogErrorPresentation(publicErrors, errorCode, status);
}
