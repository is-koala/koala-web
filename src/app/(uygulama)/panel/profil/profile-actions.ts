"use server";

import type { FormState } from "@/lib/form-state";
import { textField, validationState } from "@/server/form";
import { updateProfile, uploadProfilePicture } from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { runProfileMutation } from "./action-support";

const allowedImageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const maximumImageBytes = 10 * 1024 * 1024;

export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();

  const namesLocked = textField(formData, "namesLocked") === "true";
  const firstName = textField(formData, "firstName").trim();
  const lastName = textField(formData, "lastName").trim();
  const fieldErrors: Record<string, string> = {};
  if (!namesLocked && !firstName) fieldErrors.firstName = "Adını yazmalısın.";
  if (!namesLocked && !lastName) fieldErrors.lastName = "Soyadını yazmalısın.";
  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  return runProfileMutation(async () => {
    await updateProfile({
      ...(namesLocked ? {} : { firstName, lastName }),
      jobTitle: textField(formData, "jobTitle").trim(),
      about: textField(formData, "about").trim(),
      qualifications: textField(formData, "qualifications").trim(),
      interests: textField(formData, "interests").trim(),
    });
  });
}

export async function uploadProfilePictureAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return validationState({ image: "Bir fotoğraf seçmelisin." });
  }
  if (image.size > maximumImageBytes) {
    return validationState({ image: "Fotoğraf en fazla 10 MB olabilir." });
  }
  const extension = image.name.split(".").pop()?.toLocaleLowerCase("tr");
  if (!extension || !allowedImageExtensions.has(extension)) {
    return validationState({ image: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç." });
  }

  return runProfileMutation(() => uploadProfilePicture(image));
}
