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
  APPLICANT_IDENTITY_NOT_VERIFIED: {
    title: "Kimliğini doğrulaman gerekiyor",
    message: "Başvuru yapmadan önce kimlik doğrulamanı tamamlamalısın.",
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
  JOB_ASSIGNMENT_EMPLOYER_IDENTITY_NOT_VERIFIED: {
    title: "Kimlik bilgilerin eksik",
    message:
      "Ödeme alınmadı. Kimlik doğrulamanı ve kimlik numaranı tamamladıktan sonra yeniden deneyebilirsin.",
    action: "none",
  },
  JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER: {
    title: "Fatura adresi eksik",
    message: "Ödeme alınmadı. Fatura adresini tamamladıktan sonra yeniden deneyebilirsin.",
    action: "none",
  },
  JOB_ASSIGNMENT_NOT_READY_FOR_PAYMENT: {
    title: "Bu atama için ödeme başlatılamıyor",
    message:
      "Atamanın güncel durumunu kontrol et. Tahsil edilmiş veya işçi tarafından henüz onaylanmamış olabilir.",
    action: "retry",
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    title: "Ödeme sağlayıcısına ulaşılamadı",
    message: "Kartından ödeme alınmadı. Biraz sonra yeniden deneyebilirsin.",
    action: "retry",
  },
  PAYMENT_PROVIDER_REJECTED: {
    title: "Ödeme başlatılamadı",
    message: "Kartından ödeme alınmadı. Biraz sonra yeniden deneyebilirsin.",
    action: "retry",
  },
  PAYMENT_PAGE_URL_REJECTED: {
    title: "Güvenli ödeme sayfası açılamadı",
    message: "Yönlendirme güvenlik kontrolünden geçmedi. Kartından ödeme alınmadı.",
    action: "retry",
  },
  PAYMENT_ATTEMPT_IN_PROGRESS: {
    title: "Ödeme sonucu bekleniyor",
    message: "Devam eden ödeme denemesi kesinleşmeden yeni bir ödeme başlatılamaz.",
    action: "none",
  },
  DISPUTE_BLOCKS_RELEASE: {
    title: "Uyuşmazlık sonuçlanmayı bekliyor",
    message:
      "Açık uyuşmazlık sonuçlanana kadar atama iptal edilemez; emanetteki para iade edilmez veya işçiye aktarılmaz.",
    action: "none",
  },
  /**
   * Şirket yetkilisi uçlarının ortak reddi.
   *
   * Tek metin, çünkü backend bu kodu bilerek **ayırt edilemez** bırakıyor:
   * `requireCompanyAdmin` ile `removeContact`'in "bu kişi zaten yetkili
   * değil" dalı aynı anahtarı taşıyor, ve üyesi olunmayan bir şirketin
   * yanıtı var olmayan bir şirketinkiyle `errorCode` dahil aynı
   * (is-koala/koala-backend#85). Metnin bir nedeni seçmesi, sözleşmenin
   * kapattığı varlık bilgisini ekranda geri açardı.
   */
  USER_NOT_ASSOCIATED_WITH_COMPANY: {
    title: "Bu işlemi yapamıyoruz",
    message:
      "Şirket bulunamadı, yöneticisi olmayabilirsin ya da çıkarmak istediğin kişi artık yetkili değil. Sayfayı yenileyip listeyi kontrol et.",
    action: "retry",
  },
  // Aile metni ("Bu kayıt başka bir duruma geçmiş olabilir") burada yanlış
  // olurdu: kayıt değişmedi, kural gereği bu çıkarma hiç yapılamaz ve
  // kullanıcının atacağı somut bir adım var.
  COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED: {
    title: "Son yöneticiyi çıkaramazsın",
    message:
      "Şirkette en az bir yönetici kalmalı. Önce başka birini yönetici olarak davet et, sonra bu kişiyi çıkarabilirsin.",
    action: "none",
  },
  // Backend'in kendi cümlesi: "yok" ile "senin değil" aynı ekranda buluşuyor
  // (`company.contact.invitation.not.found`, Swagger'daki metnin aynısı).
  // Daveti okuma ve cevaplama uçlarının ikisi de bu kodu döndürüyor.
  COMPANY_CONTACT_INVITATION_NOT_FOUND: {
    title: "Davet bulunamadı",
    message: "Davet bulunamadı ya da size ait değil.",
    action: "home",
  },
  /**
   * Davet başkasının.
   *
   * `forbidden` aile metni ("Farklı bir hesapla giriş yapabilir veya ana
   * sayfaya dönebilirsin") kullanıcıyı var olmayan bir hesabı aramaya
   * gönderirdi: davet gerçekten başka birine gitmiş ve bu hesapla
   * kabul edilemez.
   */
  USER_NOT_ASSOCIATED_WITH_INVITATION: {
    title: "Bu davet sana ait değil",
    message:
      "Davet başka bir hesaba gönderilmiş. Daveti bekliyorsan davet edildiğin hesapla giriş yapman gerekiyor.",
    action: "none",
  },
  /**
   * Davet ikinci kez cevaplanamaz.
   *
   * `conflict` aile metni "sayfayı yenileyip yeniden dene" diyor; burada
   * yenilemek işe yaramaz — karar kalıcı ve geri alma ucu yok. Yine de
   * `retry`: kullanıcının görebileceği tek yeni bilgi davetin güncel durumu.
   */
  INVITATION_ALREADY_ANSWERED: {
    title: "Bu davet daha önce cevaplanmış",
    message:
      "Davet bir kez cevaplanıyor ve kararı geri almanın bir yolu yok. Güncel durumu sayfayı yenileyerek görebilirsin.",
    action: "retry",
  },
  /**
   * Şirket kurmanın kimlik reddi (`CompanyManager.java:103-105`).
   *
   * Kapı formu zaten önden kapatıyor; bu metin kapının bayatladığı ya da
   * kimliğin form açıkken düştüğü durumda görünür ve kapının kendi
   * cümlesiyle aynı yere gönderir.
   */
  USER_MUST_VERIFY_IDENTITY: {
    title: "Kimliğini doğrulaman gerekiyor",
    message:
      "Şirket kurabilmen için önce kimliğini doğrulamalısın. Doğrulamayı şimdilik Koala uygulamasından tamamlayabilirsin.",
    action: "none",
  },
  // `CompanyManager.java:94-97` enum'a çeviremediği türü 400 ile reddediyor.
  // Aile metni ("Gönderdiğin bilgilerden bazıları geçerli değil") hangi alana
  // dönüleceğini söylemezdi.
  COMPANY_TYPE_INVALID: {
    title: "Şirket türü tanınmadı",
    message: "Listedeki şirket türlerinden birini seçip yeniden dene.",
    action: "none",
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
