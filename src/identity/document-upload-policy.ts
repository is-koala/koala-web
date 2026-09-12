const mebibyte = 1024 * 1024;

export const identityPhotoSlots = ["selfie", "front", "back", "together"] as const;

export type IdentityPhotoSlot = (typeof identityPhotoSlots)[number];

export const identityPhotoFileMaxBytes = 10 * mebibyte;
export const identityPhotoContentMaxBytes = identityPhotoSlots.length * identityPhotoFileMaxBytes;

// Route Handler ham multipart gövdeyi bu sınıra kadar okur. İçerik bütçesi
// ayrı kalır; iki MiB yalnız boundary, parça başlığı ve metin alanları içindir.
export const identityPhotoTransportMaxBytes = identityPhotoContentMaxBytes + 2 * mebibyte;

export const identityDocumentUploadPath = "/api/users/me/identity-documents";

export const identityPhotoInputAccept = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
export const identityPhotoAllowedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
export const identityPhotoAllowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export const identityPhotoUploadErrors = {
  fileTooLarge: "Fotoğraf en fazla 10 MB olabilir.",
  contentTooLarge: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
  invalidMultipart: "Dört kimlik fotoğrafını yeniden seç.",
  unsupportedType: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç.",
} as const;
