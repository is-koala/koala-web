/**
 * Görsel yüklemelerinin tek biçim listesi (koala-backend#348).
 *
 * Backend `UploadProperties.imageExtensions` ve `evidenceExtensions` WebP'yi
 * hâlâ sayıyor, ama JDK ImageIO'nun WebP okuyucusu yok: `UploadValidator`
 * `rejectOversizedCanvas` her gerçek WebP'ye `STORAGE_UNSUPPORTED_TYPE`
 * dönüyor. Kimlik, galeri, profil fotoğrafı, şirket logosu
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

/** Metinlerde geçen biçim listesi. */
export const imageUploadFormatsLabel = "PNG, JPG veya JPEG";
