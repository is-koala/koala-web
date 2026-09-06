import { serviceAreaNotice } from "@/address/contract";

import { backendErrorFamilies, type BackendErrorFamily } from "./backend-error-codes";
import type { GateId } from "./gates";

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
  // Bireysel ilanın üç reddi. Üçü de aile metnine düşseydi ("Bilgileri kontrol
  // et" / "Bu işlem için yetkin yok") kullanıcı ne yapması gerektiğini
  // okuyamazdı: yapılacak iş her birinde farklı ve hiçbiri alanları gözden
  // geçirmek değil.
  JOB_INDIVIDUAL_JOB_CANNOT_REQUIRE_INSURANCE: {
    title: "Bu kategori bireysel ilanla açılamıyor",
    message:
      "Seçtiğin işte sigorta zorunlu. Sigorta yükümlülüğü işverene ait olduğu için bu iş yalnızca şirket ilanı olarak açılabiliyor.",
    action: "none",
  },
  JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED: {
    title: "Kimliğini doğrulaman gerekiyor",
    message:
      "İlanı yayımlayabilmen için önce kimliğini doğrulamalısın. Doğrulamayı şimdilik Koala uygulamasından tamamlayabilirsin.",
    action: "none",
  },
  JOB_USER_IS_NOT_EMPLOYER: {
    title: "Bu hesap işveren hesabı değil",
    message:
      "İşveren olup olmadığın kayıt sırasında seçiliyor ve bugün değiştirilemiyor. İlan açmak için işveren olarak yeni bir hesap açman gerekiyor.",
    action: "home",
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

/**
 * Bir kapının ekrandaki hâli.
 *
 * `ErrorPresentation`'dan ayrı bir tip, çünkü kaynağı da zamanı da farklı:
 * `errorPresentation` gelmiş bir backend yanıtını okur, bu ise henüz
 * yapılmamış bir isteği anlatır. Ortak olan kural aynı — ekrana çıkan metin
 * backend'in ham mesajı değil, burada yazılı Türkçe.
 */
export type GateNotice = {
  title: string;
  message: string;
  /** Kullanıcının kapıyı açmak için gideceği yer; yolu olmayan kapıda `null`. */
  remedy: { href: string; label: string } | null;
  /**
   * Bu kapının önden karşıladığı backend reddi.
   *
   * Eşleşme yazılı duruyor ki backend koşulu değişince kapının bayatladığı
   * görülebilsin. Boş liste "backend bunu hiç denetlemiyor" demek, yani kural
   * yalnız burada yaşıyor.
   */
  errorCodes: readonly string[];
};

/**
 * Kimlik doğrulama ve adres düzenleme web'de henüz yok: KYC akışı
 * is-koala/koala-web#18, adres yazma #28, şirket profili #29 ile geliyor.
 * O zamana kadar kapı kullanıcıyı boşluğa değil, işi bugün yapabildiği yere —
 * mobil uygulamaya — bırakır. Bu üç issue indiğinde değişecek tek yer burası.
 */
const openAppPath = "/uygulamayi-ac";

const gateNotices: Readonly<Record<GateId, GateNotice>> = {
  identityVerification: {
    title: "Kimliğini doğrulaman gerekiyor",
    message:
      "İlan açmak, şirket kurmak ve başvuru yapmak için önce kimliğini doğrulamalısın. Doğrulamayı şimdilik Koala uygulamasından tamamlayabilirsin.",
    remedy: { href: openAppPath, label: "Uygulamada doğrula" },
    errorCodes: [
      "JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED",
      "USER_MUST_VERIFY_IDENTITY",
      "APPLICANT_IDENTITY_NOT_VERIFIED",
    ],
  },
  identityNumber: {
    title: "Kimlik numaran hesabında kayıtlı değil",
    message:
      "Ödemeyi başlatabilmemiz için doğrulanmış kimlik numarana ihtiyacımız var. Kimlik doğrulamasını uygulamadan tamamladığında bu bilgi hesabına işlenir.",
    remedy: { href: openAppPath, label: "Uygulamada tamamla" },
    errorCodes: ["JOB_ASSIGNMENT_EMPLOYER_IDENTITY_NOT_VERIFIED"],
  },
  employerRole: {
    title: "Bu hesap işveren hesabı değil",
    message:
      "İşveren olup olmadığın kayıt sırasında seçiliyor ve bugün değiştirilemiyor. Bireysel ilan açmak için işveren olarak yeni bir hesap açman gerekiyor.",
    remedy: null,
    errorCodes: ["JOB_USER_IS_NOT_EMPLOYER"],
  },
  companyContact: {
    title: "Bu şirketin yetkilisi değilsin",
    message:
      "İlanı yalnız şirketin yetkili listesindeki kişiler açabilir. Şirket yöneticisinden seni yetkili olarak eklemesini isteyebilirsin.",
    remedy: null,
    errorCodes: ["JOB_USER_IS_NOT_A_CONTACT_OF_COMPANY"],
  },
  companyApproval: {
    title: "Şirketin henüz onaylanmadı",
    message:
      "Şirket kaydını ekibimiz inceliyor. Onay tamamlandığında şirket adına ilan açabileceksin.",
    remedy: null,
    // Backend bu kuralı uygulamıyor: `company.isApproved()` iş mantığının
    // hiçbir yerinde okunmuyor. Kural yalnız burada yaşıyor.
    errorCodes: [],
  },
  individualBillingAddress: {
    title: "Fatura adresin eksik",
    message:
      "Ödemeyi başlatabilmek için kendi fatura adresine ihtiyacımız var. Adresini şimdilik Koala uygulamasındaki profilinden ekleyebilirsin.",
    remedy: { href: openAppPath, label: "Adresini uygulamada ekle" },
    errorCodes: ["JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER"],
  },
  companyBillingAddress: {
    title: "Şirketin fatura adresi eksik",
    message:
      "Şirket ilanlarında ödeme senin adresini değil şirketin adresini kullanıyor. Şirket adresini şimdilik Koala uygulamasından düzenleyebilirsin.",
    remedy: { href: openAppPath, label: "Şirket adresini uygulamada düzenle" },
    errorCodes: ["JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER"],
  },
};

export function gateNotice(gate: GateId): GateNotice {
  return gateNotices[gate];
}
