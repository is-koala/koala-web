"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { jobGalleryPath, publishedJobPath } from "@/lib/app-routes";
import {
  galleryListFromJson,
  type GalleryMutationState,
} from "@/lib/gallery";
import { isUuid } from "@/lib/identifiers";
import {
  listJobImages,
  replaceJobGallery,
  replaceWithRules,
  uploadJobImage,
  uploadWithPrecheck,
} from "@/server/gallery/gallery";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function uploadJobGalleryAction(
  jobId: string,
  formData: FormData,
): Promise<GalleryMutationState> {
  await requireSessionForCurrentPath();
  if (!isUuid(jobId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { image: "Bir görsel seçmelisin." },
    };
  }

  try {
    const result = await uploadWithPrecheck(
      image,
      () => listJobImages(jobId),
      (file) => uploadJobImage(jobId, file),
    );
    if (result.status === "done") refresh(jobId);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

export async function replaceJobGalleryAction(
  jobId: string,
  formData: FormData,
): Promise<GalleryMutationState> {
  await requireSessionForCurrentPath();
  if (!isUuid(jobId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  const images = galleryListFromJson(String(formData.get("images") ?? ""));
  if (images === null) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    const result = await replaceWithRules(images, (body) => replaceJobGallery(jobId, body));
    if (result.status === "done") refresh(jobId);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

function refresh(jobId: string) {
  revalidatePath(jobGalleryPath(jobId));
  revalidatePath(publishedJobPath(jobId));
}
