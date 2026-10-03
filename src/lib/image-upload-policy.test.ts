import { describe, expect, it } from "vitest";

import { disputeEvidenceLimits } from "@/assignments/resolution";
import { logoAccept, logoHint } from "@/components/company/logo";
import {
  identityPhotoAllowedExtensions,
  identityPhotoAllowedMimeTypes,
  identityPhotoInputAccept,
} from "@/identity/document-upload-policy";
import { galleryAccept, galleryAcceptedExtensions } from "@/lib/gallery";

import {
  imageUploadAccept,
  imageUploadExtensions,
  imageUploadFormatsLabel,
  imageUploadMimeTypes,
} from "./image-upload-policy";

/**
 * Görsel yüklemelerinin tek listesi (koala-backend#348).
 *
 * Backend `UploadProperties.imageExtensions` ve `evidenceExtensions` WebP'yi
 * hâlâ sayıyor ama JDK ImageIO'nun WebP okuyucusu yok; `rejectOversizedCanvas`
 * her gerçek WebP'ye `STORAGE_UNSUPPORTED_TYPE` dönüyor. Bütün görsel
 * yüklemeleri (`FolderType.IMAGE`: kimlik, galeri, profil fotoğrafı, şirket
 * logosu; `DISPUTE_EVIDENCE`: kanıt) bu yoldan geçtiği için web'in her kabul
 * listesi aynı üç uzantıdan türer. Liste beş yerde ayrı yazılıyordu.
 */
describe("görsel yükleme politikası", () => {
  it("backend'in gerçekten okuyabildiği biçimleri sayar", () => {
    expect([...imageUploadExtensions]).toEqual(["png", "jpg", "jpeg"]);
    expect([...imageUploadMimeTypes]).toEqual(["image/png", "image/jpeg"]);
    expect(imageUploadAccept).not.toMatch(/webp/i);
    expect(imageUploadFormatsLabel).toBe("PNG, JPG veya JPEG");
  });

  it("kimlik, galeri, logo ve kanıt listeleri aynı kaynaktan türer", () => {
    expect(identityPhotoInputAccept).toBe(imageUploadAccept);
    expect([...identityPhotoAllowedExtensions]).toEqual([...imageUploadExtensions]);
    expect([...identityPhotoAllowedMimeTypes]).toEqual([...imageUploadMimeTypes]);
    expect(galleryAccept).toBe(imageUploadAccept);
    expect([...galleryAcceptedExtensions]).toEqual([...imageUploadExtensions]);
    expect(logoAccept).toBe(imageUploadAccept);
    expect(logoHint).toContain(imageUploadFormatsLabel);
    expect([...disputeEvidenceLimits.acceptedExtensions]).toEqual(["pdf", ...imageUploadExtensions]);
  });
});
