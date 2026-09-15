import type { ErrorCatalog } from "./error-presentation";

/** Şirket kurma, yetkili yönetimi ve davet akışlarının redleri. */
export const companyErrors: ErrorCatalog = {
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
      "Şirket kurabilmen için önce kimliğini doğrulamalısın. Dört kimlik fotoğrafını yükleyebilirsin.",
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
};
