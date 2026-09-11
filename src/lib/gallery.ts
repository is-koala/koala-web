import { isUuid } from "./identifiers";

/**
 * Galeri yazma ve yükleme ön kontrolünün istemci kuralları.
 *
 * Sunucu katmanını içe aktarmaz: hem Server Action hem `"use client"`
 * bileşenleri aynı kuralı okuyor. İki yerde ayrışsalardı ekranda geçerli
 * görünen bir liste sunucuya hiç gitmeden (ya da tam tersi, sunucunun
 * `VALIDATION_FAILED` ile sessizce düşürdüğü bir gövdeyle) ayrışırdı.
 */

/** `GalleryImageDto`. `id` galeri satırının değil, `Image.id`. */
export type GalleryImage = {
  readonly id: string;
  readonly url: string;
  readonly caption: string | null;
  readonly cover: boolean;
  readonly sortOrder: number;
};

/**
 * `GalleryImageEntryDto`. Yalnız bu dört alan gider: DTO'da olmayan bir
 * alan göndermek backend'in yok sayacağı (ya da bir gün reddedeceği) bir
 * yazma üretir, ve `imageId` yanlışlıkla satır kimliğiyle dolar.
 */
export type GalleryImageWrite = {
  readonly imageId: string;
  readonly sortOrder: number;
  readonly cover: boolean;
  readonly caption: string | null;
};

export type GalleryPutBody = {
  readonly images: readonly GalleryImageWrite[];
};

export type GalleryPutResult =
  | { readonly ok: true; readonly body: GalleryPutBody }
  | { readonly ok: false; readonly reason: "duplicateImageId" | "multipleCovers" | "captionTooLong" };

/** `UpdateGalleryDto.caption` `@Size(max = 255)`. */
export const galleryCaptionLimit = 255;

/**
 * İstemcinin yüklemeden önce kullandığı üst sınır.
 *
 * Asıl tavan ortam değişkeninden geliyor (`UPLOAD_MAX_JOB_IMAGES` /
 * `UPLOAD_MAX_COMPANY_IMAGES`); web onu okuyamaz. Bu sayı yalnız **409
 * gelmeden** dosyayı yola çıkarmamak için. 409 sonrası kalan kota GET
 * listesinin uzunluğundan hesaplanır, buradan değil.
 */
export const galleryClientLimit = 10;

export const galleryAcceptedExtensions = ["png", "jpg", "jpeg", "webp"] as const;

/** `UploadProperties` varsayılanı: görsel başına 10 MB. */
export const galleryMaxImageBytes = 10 * 1024 * 1024;

export const galleryAccept = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export type GalleryUploadRejection = {
  readonly ok: false;
  readonly reason: string;
};

export type GalleryUploadPrecheck = { readonly ok: true } | GalleryUploadRejection;

/**
 * PUT gövdesi her zaman tam listedir.
 *
 * Listede olmayan kayıt backend'de silinir (`GalleryManager.replaceJobGallery`).
 * Aynı `imageId` ve birden fazla kapak `@AssertTrue` ile düşer ve üst bantta
 * yalnız `VALIDATION_FAILED` görünür — ikisi de burada, ağdan önce.
 */
export function galleryPutBody(images: readonly GalleryImage[]): GalleryPutResult {
  const ids = images.map((image) => image.id);
  if (new Set(ids).size !== ids.length) return { ok: false, reason: "duplicateImageId" };
  if (images.filter((image) => image.cover).length > 1) {
    return { ok: false, reason: "multipleCovers" };
  }
  if (images.some((image) => (image.caption ?? "").length > galleryCaptionLimit)) {
    return { ok: false, reason: "captionTooLong" };
  }

  return {
    ok: true,
    body: {
      images: images.map((image, index) => ({
        imageId: image.id,
        sortOrder: index,
        cover: image.cover,
        caption: image.caption,
      })),
    },
  };
}

/**
 * Yüklemeden önce uzantı, boyut ve kalan kota.
 *
 * Reddedilen dosya `fetch`'e hiç girmez: backend aynı redleri 400/409 ile
 * verir ama o tur hem kota sayacını hem hız sınırını yakar.
 */
export function precheckGalleryUpload(file: File, remainingSlots: number): GalleryUploadPrecheck {
  if (remainingSlots <= 0) {
    return { ok: false, reason: galleryQuotaReason };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "Boş bir dosya yüklenemez. İçeriği olan bir görsel seç." };
  }
  if (file.size > galleryMaxImageBytes) {
    return { ok: false, reason: "Görsel en fazla 10 MB olabilir." };
  }
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr") ?? "";
  if (!galleryAcceptedExtensions.includes(extension as (typeof galleryAcceptedExtensions)[number])) {
    return { ok: false, reason: "PNG, JPG, JPEG veya WEBP biçiminde bir görsel seç." };
  }
  return { ok: true };
}

/**
 * 409 sonrası kalan yer.
 *
 * Sayı GET listesinden türetilir: kotanın tavanı ortam değişkeninde ve
 * yanıtta yok. 409 anındaki uzunluk tavanın kendisidir; silinen her görsel
 * bir yer açar. Sabit 10 burada okunmaz.
 */
export function remainingSlotsAfterLimit(
  currentCount: number,
  countWhenExhausted: number,
): number {
  return Math.max(0, countWhenExhausted - currentCount);
}

export function remainingSlotsBeforeLimit(currentCount: number): number {
  return Math.max(0, galleryClientLimit - currentCount);
}

export const galleryQuotaReason =
  "Galeri kotası doldu. Yeni görsel eklemek için önce mevcutlardan birini kaldırman gerekiyor.";

export const companyGalleryAdminNotice = "bu işlem için şirket yöneticisi olman gerekiyor";

export type GalleryMutationState =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly images: readonly GalleryImage[] }
  | {
      readonly status: "error";
      readonly errorCode: string;
      readonly httpStatus: number;
      readonly fieldErrors?: Readonly<Record<string, string>>;
      /** 409 sonrası GET'ten gelen güncel liste; kalan kota buradan okunur. */
      readonly images?: readonly GalleryImage[];
    };

export function galleryPutRejectionMessage(
  reason: "duplicateImageId" | "multipleCovers" | "captionTooLong",
): string {
  if (reason === "duplicateImageId") return "Aynı görsel galeride bir kez yer alabilir.";
  if (reason === "multipleCovers") return "Aynı anda yalnız bir kapak seçilebilir.";
  return `Açıklama en fazla ${galleryCaptionLimit} karakter olabilir.`;
}

/**
 * Action'ın tarayıcıdan aldığı tam liste.
 *
 * `imageId` burada `id` olarak duruyor: ekranın modeli `GalleryImageDto.id`
 * ve PUT çevirisi `galleryPutBody` içinde yapılıyor. Biçimi bozuk bir
 * kimlik backend'e hiç gitmez.
 */
export function galleryListFromJson(raw: string): readonly GalleryImage[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const images: GalleryImage[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      if (!isUuid(id)) return null;
      images.push({
        id,
        url: typeof record.url === "string" ? record.url : "",
        caption: typeof record.caption === "string" ? record.caption : null,
        cover: record.cover === true,
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : 0,
      });
    }
    return images;
  } catch {
    return null;
  }
}
