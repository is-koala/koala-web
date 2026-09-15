import type { ErrorCatalog } from "./error-presentation";

/** İlan ve şirket galerisinin görsel yükleme redleri. */
export const galleryErrors: ErrorCatalog = {
  STORAGE_IMAGE_TOO_LARGE: {
    title: "Görsel çok büyük",
    message: "Görsel 10 MB sınırını aşıyor. Daha küçük bir dosya seçip yeniden dene.",
    action: "none",
  },
  IMAGE_EMPTY_ERROR: {
    title: "Görsel boş",
    message: "Boş bir dosya yüklenemez. İçeriği olan bir görsel seçip yeniden dene.",
    action: "none",
  },
  IMAGE_SIZE_ERROR: {
    title: "Görsel çok büyük",
    message: "Görsel 10 MB sınırını aşıyor. Daha küçük bir dosya seçip yeniden dene.",
    action: "none",
  },
  IMAGE_UPLOAD_ERROR: {
    title: "Görsel yüklenemedi",
    message: "Görseli şu anda yükleyemedik. Biraz sonra yeniden dene.",
    action: "retry",
  },
  /**
   * Kota tavanı ortam değişkeninden gelir; yanıtta sayı yok. Metin bu yüzden
   * "10" sabitlemez — kalan yer GET listesi yenilendikten sonra hesaplanır.
   */
  GALLERY_LIMIT_EXCEEDED: {
    title: "Galeri kotası doldu",
    message:
      "Yeni görsel eklemek için önce mevcutlardan birini kaldırman gerekiyor.",
    action: "none",
  },
};
