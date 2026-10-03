import type { ErrorCatalog } from "@/lib/error-presentation";

/** Uyuşmazlık ve kanıt dosyası (yükleme, indirme) redleri. */
export const disputeErrors: ErrorCatalog = {
  DISPUTE_BLOCKS_RELEASE: {
    title: "Uyuşmazlık sonuçlanmayı bekliyor",
    message:
      "Açık uyuşmazlık sonuçlanana kadar atama iptal edilemez; emanetteki para iade edilmez veya işçiye aktarılmaz.",
    action: "none",
  },
  DISPUTE_EVIDENCE_TOO_LARGE: {
    title: "Kanıt dosyası çok büyük",
    message: "Kanıt dosyası 10 MB sınırını aşıyor. Daha küçük bir dosya seçip yeniden dene.",
    action: "none",
  },
  DISPUTE_EVIDENCE_REQUIRED: {
    title: "Kanıt dosyası seçmelisin",
    message: "Devam etmek için PDF, PNG, JPG veya JPEG biçiminde bir kanıt dosyası seç.",
    action: "none",
  },
  DISPUTE_EVIDENCE_TOO_MANY: {
    title: "Tek dosya seçebilirsin",
    message: "Her yüklemede yalnızca bir kanıt dosyası seçip yeniden dene.",
    action: "none",
  },
  DISPUTE_EVIDENCE_EMPTY: {
    title: "Kanıt dosyası boş",
    message: "Boş bir dosya yüklenemez. İçeriği olan bir dosya seçip yeniden dene.",
    action: "none",
  },
  DISPUTE_EVIDENCE_LIMIT_REACHED: {
    title: "Kanıt sınırına ulaşıldı",
    message: "Bu uyuşmazlığa en fazla 5 kanıt dosyası eklenebilir; yeni dosya yükleyemezsin.",
    action: "none",
  },
  DISPUTE_EVIDENCE_DISPUTE_CLOSED: {
    title: "Uyuşmazlık sonuçlandı",
    message: "Sonuçlanmış uyuşmazlığa yeni kanıt eklenemez. Güncel kararı sayfada görebilirsin.",
    action: "none",
  },
  DISPUTE_EVIDENCE_UPLOAD_FAILED: {
    title: "Kanıt yüklenemedi",
    message: "Kanıt dosyasını şu anda yükleyemedik. Biraz sonra yeniden dene.",
    action: "retry",
  },
  DISPUTE_EVIDENCE_NOT_FOUND: {
    title: "Kanıt dosyası bulunamadı",
    message: "Dosya kaldırılmış veya liste bu sırada değişmiş olabilir. Sayfayı yenileyip yeniden dene.",
    action: "retry",
  },
  STORAGE_UNSUPPORTED_TYPE: {
    title: "Dosya biçimi desteklenmiyor",
    message: "PDF, PNG, JPG veya JPEG biçiminde geçerli bir dosya seçip yeniden dene.",
    action: "none",
  },
  STORAGE_DOWNLOAD_FAILED: {
    title: "Kanıt indirilemedi",
    message: "Kanıt dosyasını şu anda indiremedik. Biraz sonra yeniden dene.",
    action: "retry",
  },
};

/**
 * İşçi kimliğini görüntülemenin iki reddi (is-koala/koala-web#185).
 *
 * Kabuk kataloğuna (`@/lib/errors`) **birleştirilmiyor**: iki cümle yalnız
 * atama sayfasındaki bölümde okunuyor ve bileşen onları önce buradan, sonra
 * kabuk kataloğundan seçiyor. Kabuğun her sayfasına iki cümle daha yüklemenin
 * karşılığı yok. 404 ise `assignmentNotFoundMessage` ile öbür eylemlerle aynı.
 */
export const identityRevealErrors: ErrorCatalog = {
  WORKER_IDENTITY_NOT_VERIFIED: {
    title: "Çalışanın kimliği doğrulanmamış",
    message:
      "Sigorta bildirimi için çalışanın kimlik doğrulamasını tamamlaması gerekiyor. Doğrulama bitince bilgileri buradan görüntüleyebilirsiniz.",
    action: "none",
  },
  IDENTITY_REVEAL_TOO_MANY_REQUESTS: {
    title: "Çok sık görüntülendi",
    message: "Saatlik kimlik görüntüleme sınırına ulaştınız. Biraz sonra yeniden deneyin.",
    action: "retry",
  },
};
