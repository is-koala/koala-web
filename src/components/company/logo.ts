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
export const logoAccept = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

/** `UploadProperties`: 10 MB, 50 megapiksel, dört uzantı. */
export const logoHint = "PNG, JPG, JPEG veya WEBP · en fazla 10 MB";
