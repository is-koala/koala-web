import type { ErrorPresentation } from "@/lib/error-presentation";

/**
 * Ticari e-postadaki çıkış bağlantısının indiği sayfanın metinleri
 * (is-koala/koala-web#54).
 *
 * Kategori ve kanal ancak onaydan sonra belli oluyor: backend onları yalnız
 * POST yanıtında döndürüyor. Sayfa bu yüzden açılışta "bu e-postanın türü"
 * diye genel konuşur, sonucu kapanan türü adıyla gösterir.
 */
export const unsubscribeContent = {
  eyebrow: "Bildirim tercihleri",
  title: "Abonelikten çık",
  // Token yalnız e-posta kanalını kapatıyor; aynı türün anlık ve uygulama içi
  // bildirimleri sürer — metin "bildirim türü kapanır" demez.
  intro:
    "Onaylarsan bu türdeki e-postalar artık gönderilmez. Diğer e-postaların ve bildirimlerin olduğu gibi kalır.",
  confirmLabel: "Abonelikten çık",
  pendingLabel: "Kapatılıyor…",
  confirmNote: "Düğmeye basmadan hiçbir tercihin değişmez.",
  noScript:
    "Bu işlem için tarayıcında JavaScript açık olmalı. Bildirim tercihlerini Koala uygulamasından da yönetebilirsin.",
  doneTitle: "Abonelikten çıktın",
  doneBody: "Bu bildirimleri artık almayacaksın.",
  alreadyTitle: "Bu bildirimler zaten kapalı",
  alreadyBody: "Bu bağlantının kapattığı bildirimler daha önce kapatılmış; yeni bir değişiklik yapılmadı.",
  categoryTerm: "Bildirim türü",
  channelTerm: "Kanal",
  manageBody:
    "Bütün bildirim tercihlerini Koala uygulamasından ya da web'de Hesap ve ayarlar sayfasından yönetebilirsin.",
  manageAction: "Bildirim tercihlerimi yönet",
} as const;

/**
 * Bağlantının kendisinden kaynaklanan iki ret.
 *
 * Bunlar backend kodundan seçilen genel katalog cümleleri değil, sayfanın iki
 * sonucu: `NOTIFICATION_UNSUBSCRIBE_TOKEN_*` kodları yalnız bu rotada
 * görülüyor. Herkese açık kataloğa (`public-errors.ts`) yazılsalardı ilan
 * ayrıntısının betik bütçesine binerlerdi; öbür her ret o katalogdan okunur.
 */
export const unsubscribeLinkProblems = {
  expired: {
    title: "Bağlantının süresi dolmuş",
    message:
      "Daha yeni bir e-postadaki bağlantıyı kullanabilir ya da bildirim tercihlerini aşağıdan yönetebilirsin.",
    action: "none",
  },
  invalid: {
    title: "Bağlantı geçersiz",
    message:
      "E-postandaki bağlantıyı yeniden açmayı dene. Sorun sürerse bildirim tercihlerini aşağıdan yönetebilirsin.",
    action: "none",
  },
} as const satisfies Record<"expired" | "invalid", ErrorPresentation>;
