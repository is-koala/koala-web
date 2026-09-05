export const accountContent = {
  "hesap-dogrula": {
    title: "Hesabını tamamla",
    intro: "E-posta adresin doğrulandı. Hesabını tamamlamak için Koala uygulamasına geç.",
    destination: "hesap-dogrula",
  },
  "sifre-sifirla": {
    title: "Yeni parolanı belirle",
    intro: "Yeni parolanı güvenle belirlemek için Koala uygulamasına geç.",
    destination: "sifre-sifirla",
  },
} as const;

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
} as const;

export const trustMessage = "Bu sayfa hesabında tek başına bir değişiklik yapmaz.";
