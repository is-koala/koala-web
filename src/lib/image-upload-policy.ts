/**
 * Görsel yüklemelerinin tek biçim listesi (koala-backend#348).
 *
 * JDK ImageIO'nun WebP okuyucusu yok: `UploadValidator.rejectOversizedCanvas`
 * her gerçek WebP'yi `STORAGE_UNSUPPORTED_TYPE` ile reddediyordu. Backend
 * #348 WebP'yi `UploadProperties.imageExtensions` ve `evidenceExtensions`
 * listelerinden çıkardı; bu dosya o listelerin web karşılığıdır. Kimlik, galeri, profil fotoğrafı, şirket logosu
 * (`FolderType.IMAGE`) ve uyuşmazlık kanıtının görselleri
 * (`DISPUTE_EVIDENCE`) aynı yoldan geçtiği için web yalnız backend'in
 * gerçekten okuyabildiği üç uzantıyı kabul eder. Liste eskiden beş ayrı
 * yerde yazılıydı; artık her kabul listesi buradan türüyor
 * (`image-upload-policy.test.ts`).
 */
export const imageUploadExtensions = ["png", "jpg", "jpeg"] as const;

export const imageUploadMimeTypes = ["image/png", "image/jpeg"] as const;

/** `<input type="file" accept>`; MIME ve uzantı birlikte, bazı tarayıcılar yalnız birini okuyor. */
export const imageUploadAccept = [
  ...imageUploadMimeTypes,
  ...imageUploadExtensions.map((extension) => `.${extension}`),
].join(",");

/**
 * Metinlerde geçen biçim listesi. JPG ile JPEG aynı biçim; backend'in
 * `storage.unsupported.type` metni de "PNG ya da JPEG" diyor.
 */
export const imageUploadFormatsLabel = "PNG ya da JPEG";

/** Uyuşmazlık kanıtı görsellere ek olarak PDF de kabul eder (`evidenceExtensions`). */
export const evidenceUploadFormatsLabel = `PDF, ${imageUploadFormatsLabel}`;
