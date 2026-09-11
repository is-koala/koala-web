import "server-only";

import {
  galleryPutBody,
  galleryPutRejectionMessage,
  precheckGalleryUpload,
  remainingSlotsBeforeLimit,
  type GalleryImage,
  type GalleryMutationState,
  type GalleryPutBody,
} from "@/lib/gallery";
import { isUuid } from "@/lib/identifiers";
import { safeImageUrl } from "@/lib/urls";
import { clean } from "@/server/api/dto";
import { ApiError } from "@/server/api/errors";
import { companyPath } from "@/server/company/company";
import { jobPath } from "@/server/contract";
import { failureView } from "@/server/form";
import { apiRequest } from "@/server/session/session";

/**
 * Galeri uçlarının oturumlu BFF yüzeyi.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmuyor (ADR-0011): yükleme, toptan
 * yazma ve listeleme yalnız `apiRequest` üzerinden gider, yani 401 sonrası
 * yenileme aynı `FormData` nesnesini korur.
 */

/** `GalleryImageDto` — `id` `Image.id`. */
type GalleryImageDto = {
  id?: string | null;
  url?: string | null;
  caption?: string | null;
  cover?: boolean | null;
  sortOrder?: number | null;
};

export function listJobImages(jobId: string): Promise<readonly GalleryImage[]> {
  return readGallery(`${jobPath(jobId)}/images`);
}

export function listCompanyImages(companyId: string): Promise<readonly GalleryImage[]> {
  return readGallery(`${companyPath(companyId)}/images`);
}

/**
 * `POST .../images`, parça adı `image`.
 *
 * İlk görsel backend'de kendiliğinden kapak olur; istemci onu ayrıca
 * işaretlemez.
 */
export async function uploadJobImage(jobId: string, image: File): Promise<readonly GalleryImage[]> {
  return uploadGallery(`${jobPath(jobId)}/images`, image);
}

export async function uploadCompanyImage(
  companyId: string,
  image: File,
): Promise<readonly GalleryImage[]> {
  return uploadGallery(`${companyPath(companyId)}/images`, image);
}

/**
 * `PUT .../images` — gövde her zaman tam listedir.
 *
 * Eksik gönderilen kayıt sessizce düşer; çağıran `galleryPutBody` ile
 * kuralı ağdan önce uygular.
 */
export async function replaceJobGallery(
  jobId: string,
  body: GalleryPutBody,
): Promise<readonly GalleryImage[]> {
  return writeGallery(`${jobPath(jobId)}/images`, body);
}

export async function replaceCompanyGallery(
  companyId: string,
  body: GalleryPutBody,
): Promise<readonly GalleryImage[]> {
  return writeGallery(`${companyPath(companyId)}/images`, body);
}

export async function uploadWithPrecheck(
  file: File,
  list: () => Promise<readonly GalleryImage[]>,
  upload: (image: File) => Promise<readonly GalleryImage[]>,
): Promise<GalleryMutationState> {
  /*
   * Tür ve boyut kotadan bağımsız: kalan yer için GET etmek, reddedilecek
   * bir dosyayı bile ağa çıkarırdı. Kota kontrolü GET'ten sonra.
   */
  const typeCheck = precheckGalleryUpload(file, 1);
  if (!typeCheck.ok) {
    return {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { image: typeCheck.reason },
    };
  }

  const current = await list();
  const quotaCheck = precheckGalleryUpload(file, remainingSlotsBeforeLimit(current.length));
  if (!quotaCheck.ok) {
    return {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { image: quotaCheck.reason },
    };
  }

  try {
    return { status: "done", images: await upload(file) };
  } catch (error) {
    if (error instanceof ApiError && error.errorCode === "GALLERY_LIMIT_EXCEEDED") {
      return {
        status: "error",
        errorCode: error.errorCode,
        httpStatus: error.status,
        images: await list(),
      };
    }
    return { status: "error", ...failureView(error) };
  }
}

export async function replaceWithRules(
  images: readonly GalleryImage[],
  write: (body: GalleryPutBody) => Promise<readonly GalleryImage[]>,
): Promise<GalleryMutationState> {
  const put = galleryPutBody(images);
  if (!put.ok) {
    return {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { images: galleryPutRejectionMessage(put.reason) },
    };
  }

  try {
    return { status: "done", images: await write(put.body) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

async function readGallery(path: string): Promise<readonly GalleryImage[]> {
  const dto = await apiRequest<readonly GalleryImageDto[] | null>(path);
  return toGallery(dto);
}

async function uploadGallery(path: string, image: File): Promise<readonly GalleryImage[]> {
  const body = new FormData();
  body.set("image", image);
  return toGallery(await apiRequest<readonly GalleryImageDto[] | null>(path, { method: "POST", body }));
}

async function writeGallery(path: string, body: GalleryPutBody): Promise<readonly GalleryImage[]> {
  return toGallery(
    await apiRequest<readonly GalleryImageDto[] | null>(path, { method: "PUT", body }),
  );
}

function toGallery(dto: readonly GalleryImageDto[] | null | undefined): readonly GalleryImage[] {
  return (dto ?? []).flatMap((entry) => {
    const id = entry?.id ?? "";
    const url = safeImageUrl(clean(entry?.url));
    if (!isUuid(id) || url === null) return [];
    return [
      {
        id,
        url,
        caption: clean(entry?.caption),
        cover: entry?.cover === true,
        sortOrder: typeof entry?.sortOrder === "number" ? entry.sortOrder : 0,
      },
    ];
  });
}
