"use server";

import type { FormState } from "@/lib/form-state";
import { failureState, textField, validationState } from "@/server/form";
import { submitIdentityDocuments } from "@/server/identity/documents";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import { unstable_rethrow } from "next/navigation";

const allowedImageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const maximumImageBytes = 10 * 1024 * 1024;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const tcIdentityPattern = /^[1-9][0-9]{9}[02468]$/;

export async function submitIdentityDocumentsAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;
  await requireSessionForCurrentPath();

  const firstName = textField(formData, "firstName").trim();
  const lastName = textField(formData, "lastName").trim();
  const birthDate = textField(formData, "birthDate").trim();
  const identityNumber = textField(formData, "identityNumber").trim();
  const tcDocumentNumber = textField(formData, "tcDocumentNumber").trim();
  const fieldErrors: Record<string, string> = {};

  if (!firstName) fieldErrors.firstName = "Adını yazmalısın.";
  if (!lastName) fieldErrors.lastName = "Soyadını yazmalısın.";
  if (!datePattern.test(birthDate)) fieldErrors.birthDate = "Doğum tarihini yıl-ay-gün olarak seç.";
  if (!tcIdentityPattern.test(identityNumber)) {
    fieldErrors.identityNumber = "T.C. kimlik numarası 11 haneli olmalı.";
  }
  if (!tcDocumentNumber) fieldErrors.tcDocumentNumber = "Kimlik seri numarasını yazmalısın.";

  const selfie = photoOf(formData, "selfie");
  const front = photoOf(formData, "front");
  const back = photoOf(formData, "back");
  const together = photoOf(formData, "together");
  if (selfie === null) fieldErrors.selfie = "Yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("selfie", selfie));
  if (front === null) fieldErrors.front = "Kimliğin ön yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("front", front));
  if (back === null) fieldErrors.back = "Kimliğin arka yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("back", back));
  if (together === null) fieldErrors.together = "Kartın yüzünün altında olduğu fotoğrafı seç.";
  else Object.assign(fieldErrors, photoErrors("together", together));

  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  try {
    await submitIdentityDocuments(
      { firstName, lastName, birthDate, identityNumber, tcDocumentNumber },
      { selfie: selfie!, front: front!, back: back!, together: together! },
    );
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }

  return { status: "done" };
}

function photoOf(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function photoErrors(field: string, photo: File): Record<string, string> {
  if (photo.size > maximumImageBytes) {
    return { [field]: "Fotoğraf en fazla 10 MB olabilir." };
  }
  const extension = photo.name.split(".").pop()?.toLocaleLowerCase("tr");
  if (!extension || !allowedImageExtensions.has(extension)) {
    return { [field]: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç." };
  }
  return {};
}
