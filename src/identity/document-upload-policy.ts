import {
  imageUploadAccept,
  imageUploadExtensions,
  imageUploadFormatsLabel,
  imageUploadMimeTypes,
} from "@/lib/image-upload-policy";

const mebibyte = 1024 * 1024;

export const identityPhotoSlots = ["selfie", "front", "back", "together"] as const;

export type IdentityPhotoSlot = (typeof identityPhotoSlots)[number];

export const identityPhotoFileMaxBytes = 10 * mebibyte;
export const identityPhotoContentMaxBytes = identityPhotoSlots.length * identityPhotoFileMaxBytes;

// Route Handler ham multipart gövdeyi bu sınıra kadar okur. İçerik bütçesi
// ayrı kalır; iki MiB yalnız boundary, parça başlığı ve metin alanları içindir.
export const identityPhotoTransportMaxBytes = identityPhotoContentMaxBytes + 2 * mebibyte;

export const identityDocumentUploadPath = "/api/users/me/identity-documents";

// Biçimler görsel yükleme politikasından (WebP yok, koala-backend#348).
export const identityPhotoInputAccept = imageUploadAccept;
export const identityPhotoAllowedExtensions: ReadonlySet<string> = new Set(imageUploadExtensions);
export const identityPhotoAllowedMimeTypes: ReadonlySet<string> = new Set(imageUploadMimeTypes);

export const identityPhotoUploadErrors = {
  fileTooLarge: "Fotoğraf en fazla 10 MB olabilir.",
  contentTooLarge: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
  invalidMultipart: "Dört kimlik fotoğrafını yeniden seç.",
  timedOut: "Yükleme durdu. İnternet bağlantını kontrol edip yeniden dene.",
  unsupportedType: `${imageUploadFormatsLabel} biçiminde bir fotoğraf seç.`,
} as const;
