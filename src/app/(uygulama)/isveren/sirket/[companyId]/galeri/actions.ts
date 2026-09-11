"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { companyGalleryPath, companyProfilePath } from "@/lib/app-routes";
import {
  galleryListFromJson,
  type GalleryMutationState,
} from "@/lib/gallery";
import { isUuid } from "@/lib/identifiers";
import {
  listCompanyImages,
  replaceCompanyGallery,
  replaceWithRules,
  uploadCompanyImage,
  uploadWithPrecheck,
} from "@/server/gallery/gallery";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function uploadCompanyGalleryAction(
  companyId: string,
  formData: FormData,
): Promise<GalleryMutationState> {
  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) {
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
      () => listCompanyImages(companyId),
      (file) => uploadCompanyImage(companyId, file),
    );
    if (result.status === "done") refresh(companyId);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

export async function replaceCompanyGalleryAction(
  companyId: string,
  formData: FormData,
): Promise<GalleryMutationState> {
  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  const images = galleryListFromJson(String(formData.get("images") ?? ""));
  if (images === null) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    const result = await replaceWithRules(images, (body) => replaceCompanyGallery(companyId, body));
    if (result.status === "done") refresh(companyId);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

function refresh(companyId: string) {
  revalidatePath(companyGalleryPath(companyId));
  revalidatePath(companyProfilePath(companyId));
}
