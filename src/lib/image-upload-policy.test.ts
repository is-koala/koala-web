import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { disputeErrors } from "@/assignments/errors";
import { disputeEvidenceLimits } from "@/assignments/resolution";
import { logoAccept, logoHint } from "@/components/company/logo";
import {
  identityPhotoAllowedExtensions,
  identityPhotoAllowedMimeTypes,
  identityPhotoInputAccept,
} from "@/identity/document-upload-policy";
import { galleryAccept, galleryAcceptedExtensions } from "@/lib/gallery";

import {
  evidenceUploadFormatsLabel,
  imageUploadAccept,
  imageUploadExtensions,
  imageUploadFormatsLabel,
  imageUploadMimeTypes,
} from "./image-upload-policy";

/**
 * Görsel yüklemelerinin tek listesi (koala-backend#348).
 *
 * JDK ImageIO'nun WebP okuyucusu yok; `rejectOversizedCanvas` her gerçek
 * WebP'yi `STORAGE_UNSUPPORTED_TYPE` ile reddediyordu ve backend #348 WebP'yi
 * `imageExtensions` ile `evidenceExtensions` listelerinden çıkardı. Bütün görsel
 * yüklemeleri (`FolderType.IMAGE`: kimlik, galeri, profil fotoğrafı, şirket
 * logosu; `DISPUTE_EVIDENCE`: kanıt) bu yoldan geçtiği için web'in her kabul
 * listesi aynı üç uzantıdan türer. Liste beş yerde ayrı yazılıyordu.
 */
describe("görsel yükleme politikası", () => {
  it("backend'in gerçekten okuyabildiği biçimleri sayar", () => {
    expect([...imageUploadExtensions]).toEqual(["png", "jpg", "jpeg"]);
    expect([...imageUploadMimeTypes]).toEqual(["image/png", "image/jpeg"]);
    expect(imageUploadAccept).not.toMatch(/webp/i);
    expect(imageUploadFormatsLabel).toBe("PNG ya da JPEG");
    expect(evidenceUploadFormatsLabel).toBe("PDF, PNG ya da JPEG");
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

/**
 * Biçim listesi kullanıcıya görünen metinlerde de geçiyor: kanıt hata
 * kartları, kanıt alanının ipucu, galeri yükleme başlığı ve galerinin boş
 * durumu. Bunlar elle yazıldığında liste değişince sessizce bayatlıyordu
 * ("PNG, JPG veya JPEG" backend #348'den sonra da öyle kaldı). Metinler
 * etiketten türer; tarama, etiketin yerine geri yazılmış bir liste
 * literalini yakalar. Kapsam `src/` altındaki test olmayan `.ts`/`.tsx`
 * dosyaları; politika dosyası tek istisna.
 */
describe("biçim metinleri", () => {
  it("kanıt hata kartları kanıt etiketinden türer", () => {
    expect(disputeErrors.DISPUTE_EVIDENCE_REQUIRED?.message).toContain(evidenceUploadFormatsLabel);
    expect(disputeErrors.STORAGE_UNSUPPORTED_TYPE?.message).toContain(evidenceUploadFormatsLabel);
  });

  it("kaynakta elle yazılmış biçim listesi kalmaz", () => {
    const srcRoot = path.resolve(import.meta.dirname, "..");
    const policyFile = path.join(srcRoot, "lib", "image-upload-policy.ts");
    const handWrittenList = /\b(?:PNG|JPE?G)\s*(?:,|veya|ya da)\s*(?:PNG|JPE?G)\b/;
    const offenders = readdirSync(srcRoot, { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      .map((entry) => path.join(srcRoot, entry))
      .filter((file) => file !== policyFile)
      .filter((file) => handWrittenList.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));

    expect(offenders).toEqual([]);
  });
});
