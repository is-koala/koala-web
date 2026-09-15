export const registrationContent = {
  eyebrow: "Koala hesabı",
  title: "Kayıt ol",
  intro:
    "Adını ve e-posta adresini bırak; hesabını açman için doğrulama bağlantısını gönderelim.",
  sentTitle: "E-postanı kontrol et",
  sentBody:
    "Bu adres daha önce kayıtlı değilse doğrulama bağlantısını gönderdik. Bağlantı bir saat geçerli.",
} as const;

export const setPasswordContent = {
  eyebrow: "Koala hesabı",
  title: "Parolanı belirle",
  intro: "Kaydını tamamlamak için bir parola seç ve sözleşmeleri onayla.",
  consentsTitle: "Sözleşmeler",
  rejectedTitle: "Kayıt bağlantısı doğrulanamadı",
  rejectedBody: "Yeni bir kayıt bağlantısı isteyip yeniden deneyebilirsin.",
} as const;

export const forgotPasswordContent = {
  eyebrow: "Parola yardımı",
  title: "Parolanı mı unuttun?",
  intro: "E-posta adresini yaz; parolanı yenilemen için bir bağlantı gönderelim.",
  sentTitle: "E-postanı kontrol et",
  sentBody: "Bu adres kayıtlıysa parola yenileme bağlantısını gönderdik.",
} as const;

export const resetPasswordContent = {
  eyebrow: "Parola yardımı",
  title: "Yeni parolanı belirle",
  intro: "Yeni parolan kaydedildiği anda geçerli olur.",
  sessionWarning:
    "Parolanı değiştirdiğinde bütün cihazlardaki oturumların kapanır ve Koala'ya yeniden giriş yapman gerekir.",
  doneTitle: "Parolan güncellendi",
  doneBody: "Yeni parolanla giriş yapabilirsin.",
} as const;

export const openInAppContent = {
  title: "Uygulamada tamamla",
  body: "Koala uygulaması telefonunda kuruluysa bu işlemi orada da bitirebilirsin.",
} as const;

/** E-postadan gelen karşılama sayfalarının ortak üst başlığı. */
export const secureLinkEyebrow = "Koala güvenli bağlantı";

export const invalidLinkContent = {
  title: "Bağlantı geçersiz",
  body: "E-postandaki bağlantıyı yeniden açmayı dene. Sorun sürerse bizimle iletişime geç.",
} as const;

export const emailVerificationContent = {
  eyebrow: "E-posta doğrulama",
  title: "6 haneli kodunu gir",
  body: "Maildeki 6 haneli kodu Koala uygulamasındaki e-posta doğrulama ekranına gir.",
  action: "Uygulamayı aç",
} as const;

export const identityHandoffContent = {
  eyebrow: "Kimlik doğrulama",
  title: "Kimliğini belgelerle doğrula",
  body:
    "İlan açmak, şirket kurmak ve başvuru yapmak için dört fotoğraf yükle: yüzün, TCKK ön, TCKK arka ve TCKK yüzün altında (aynı karede yüz + kart). Personel onayından sonra kimliğin doğrulanır; tarayıcı çip okuyamaz.",
  continueLabel: "Doğruladıktan sonra devam et",
  pendingTitle: "Belgelerin inceleniyor",
  pendingBody:
    "Dört kimlik fotoğrafın personel kuyruğunda. Onaylanınca hesabın doğrulanmış olur; sonuçlanmadan yeni bir yükleme yapılamaz.",
  rejectedTitle: "Belgelerin reddedildi",
  rejectedBody: "Personel gerekçesini okuyup yeni fotoğraflarla tekrar gönderebilirsin.",
  rejectionReasonLabel: "Personel gerekçesi",
} as const;

export const openAppContent = {
  eyebrow: "Mobil uygulama",
  title: "Koala'da devam et",
  body: "Telefonunda uygulamayı aç veya QR kodu tara.",
  invalidTitle: "Hedef geçersiz",
  invalidBody: "Bu bağlantı Koala uygulamasında güvenle açılamıyor.",
} as const;

export const paymentContent = {
  eyebrow: "Ödeme sonucu",
  successTitle: "Ödeme işlemi alındı",
  failedTitle: "Ödeme tamamlanamadı",
  body: "Ödemenin doğrulanmış durumunu ve iş ayrıntılarını Koala uygulamasından takip edebilirsin.",
  invalidTitle: "Ödeme sonucu okunamadı",
  invalidBody: "Ödemenin durumunu uygulamadaki iş detayından kontrol edebilirsin.",
  guestLede:
    "Bu bildirim tek başına finansal sonuç değildir. Doğrulanmış durumu giriş yaptıktan sonra atama ayrıntısından takip edebilirsin.",
  guestTimeout:
    "Otomatik kontrol oturum olmadan yapılamaz. Ödeme kesinleşene kadar yeni bir ödeme başlatma.",
  homeLabel: "Ana sayfaya dön",
  jobsLabel: "İş ilanları",
} as const;

export const trustMessage = "Bu sayfa hesabında tek başına bir değişiklik yapmaz.";
