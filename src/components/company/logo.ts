import { imageUploadAccept, imageUploadFormatsLabel } from "@/lib/image-upload-policy";

/**
 * Logo dosyasının istemciye söylenen sınırları.
 *
 * İki form da (oluşturma ve logo değiştirme) aynı metni yazıyor; ayrışsalar
 * biri kullanıcıya backend'in kabul etmeyeceği bir dosyayı seçtirirdi.
 *
 * `UploadValidator` desteklenen türü **dosya adının uzantısından** okuyor,
 * MIME tipinden değil: uzantısız bir dosya, içeriği geçerli bir PNG olsa bile
 * "desteklenmeyen tür" ile reddediliyor. `accept` bu yüzden uzantıları da
 * sayıyor.
 */
export const logoAccept = imageUploadAccept;

/** `UploadProperties`: 10 MB, 50 megapiksel; biçimler görsel yükleme politikasından (WebP yok, koala-backend#348). */
export const logoHint = `${imageUploadFormatsLabel} · en fazla 10 MB`;
