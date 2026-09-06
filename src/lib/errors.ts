import { serviceAreaNotice } from "@/address/contract";

import { backendErrorFamilies, type BackendErrorFamily } from "./backend-error-codes";

export type ErrorAction = "login" | "home" | "retry" | "none";

export type ErrorPresentation = {
  title: string;
  message: string;
  action: ErrorAction;
};

const exactErrors: Record<string, ErrorPresentation> = {
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
  // Adres ağ geçidinin kodları `validation` ve `external` ailelerine düşüyor;
  // aile metinleri ("Bilgileri kontrol et") burada yanlış olurdu, çünkü
  // kullanıcının düzeltebileceği bir alan yok ya da yapılacak iş farklı.
  ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA: {
    title: "Bu adres hizmet alanımızın dışında",
    message: serviceAreaNotice,
    action: "none",
  },
  ADDRESS_SEARCHPROVIDER_UNAVAILABLE: {
    title: "Adres araması şu anda çalışmıyor",
    message: "Adres alanlarını elle doldurup devam edebilirsin.",
    action: "retry",
  },
  ADDRESS_CANDIDATETOKEN_INVALID: {
    title: "Adres onayının süresi doldu",
    message: "Adresi yeniden aratıp listeden seçmen gerekiyor.",
    action: "retry",
  },
  ADDRESS_SEARCHSESSION_INVALID: {
    title: "Aramayı yeniden başlatmamız gerekti",
    message: "Aynı adresi yeniden aratabilirsin; yazdıkların duruyor.",
    action: "retry",
  },
  ADDRESS_SEARCHCANDIDATE_INVALID: {
    title: "Aramayı yeniden başlatmamız gerekti",
    message: "Aynı adresi yeniden aratabilirsin; yazdıkların duruyor.",
    action: "retry",
  },
  ADDRESS_SEARCHQUERY_INVALID: {
    title: "Arama en az 3 karakter olmalı",
    message: "Sokak ya da mahalle adının birkaç harfini daha yaz.",
    action: "none",
  },
  ADDRESS_REVERSE_NORESULT: {
    title: "Bu konum için adres bulunamadı",
    message: "Konumu biraz oynatabilir ya da adres alanlarını elle doldurabilirsin.",
    action: "none",
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

export function errorPresentation(
  errorCode: string | null | undefined,
  status: number,
): ErrorPresentation {
  if (errorCode && exactErrors[errorCode]) return exactErrors[errorCode];
  if (errorCode && backendErrorFamilies[errorCode]) {
    return familyErrors[backendErrorFamilies[errorCode]];
  }
  if (status === 401) return exactErrors.AUTHENTICATION_REQUIRED;
  if (status === 403) return exactErrors.ACCESS_DENIED;
  if (status === 404) {
    return {
      title: "Aradığın içerik bulunamadı",
      message: "Bağlantıyı kontrol edebilir veya ana sayfaya dönebilirsin.",
      action: "home",
    };
  }
  return {
    title: "Bir sorun oluştu",
    message: "İşlemi şu anda tamamlayamadık. Biraz sonra yeniden dene.",
    action: "retry",
  };
}
