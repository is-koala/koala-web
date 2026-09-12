import "server-only";

import {
  identityPhotoAllowedExtensions,
  identityPhotoAllowedMimeTypes,
  identityPhotoContentMaxBytes,
  identityPhotoFileMaxBytes,
  identityPhotoTransportMaxBytes,
  identityPhotoUploadErrors,
} from "@/identity/document-upload-policy";
import type { FormState } from "@/lib/form-state";
import { textField, validationState } from "@/server/form";

import type { IdentityDocumentDeclaration, IdentityPhotos } from "./documents";

export type IdentityUploadRequest =
  | { ok: true; identity: IdentityDocumentDeclaration; photos: IdentityPhotos }
  | { ok: false; state: FormState };

/** Ham gövdeyi sabit bütçede tutar, ardından multipart içeriği doğrular. */
export async function readIdentityUploadRequest(
  request: Request,
  options: { readonly idleTimeoutMs: number; readonly totalTimeoutMs: number },
): Promise<IdentityUploadRequest> {
  if (declaredBodyIsTooLarge(request.headers)) return uploadTooLarge();

  const body = await readBoundedBody(
    request.body,
    options.idleTimeoutMs,
    options.totalTimeoutMs,
  );
  if (body.tooLarge) return uploadTooLarge();
  if (body.timedOut) return uploadTimedOut();

  const form = await parseMultipartForm(body.bytes, request.headers.get("content-type"));
  if (!form) {
    return {
      ok: false,
      state: validationState({ photos: identityPhotoUploadErrors.invalidMultipart }),
    };
  }
  return validatedUpload(form);
}

function declaredBodyIsTooLarge(headers: Headers): boolean {
  const value = headers.get("content-length");
  return Boolean(value && /^\d+$/.test(value) && Number(value) > identityPhotoTransportMaxBytes);
}

async function readBoundedBody(
  stream: ReadableStream<Uint8Array> | null,
  idleTimeoutMs: number,
  totalTimeoutMs: number,
): Promise<
  | { tooLarge: true; timedOut: false }
  | { tooLarge: false; timedOut: true }
  | { tooLarge: false; timedOut: false; bytes: Uint8Array<ArrayBuffer> }
> {
  if (!stream) {
    return { tooLarge: false, timedOut: false, bytes: new Uint8Array(new ArrayBuffer(0)) };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  const deadline = performance.now() + totalTimeoutMs;
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        const remainingMs = deadline - performance.now();
        if (remainingMs <= 0) throw bodyReadTimedOut;
        chunk = await readWithIdleTimeout(reader, Math.min(idleTimeoutMs, remainingMs));
      } catch (error) {
        if (error !== bodyReadTimedOut) throw error;
        try {
          await reader.cancel("identity upload body idle timeout");
        } catch {
          // Bağlantı zaten kapanmış olabilir; kapasite yine finally ile bırakılır.
        }
        return { tooLarge: false, timedOut: true };
      }
      const { done, value } = chunk;
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > identityPhotoTransportMaxBytes) {
        await reader.cancel("identity upload payload too large");
        return { tooLarge: true, timedOut: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(new ArrayBuffer(receivedBytes));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { tooLarge: false, timedOut: false, bytes };
}

const bodyReadTimedOut = Symbol("identity upload body read timed out");

function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(bodyReadTimedOut), idleTimeoutMs);
    reader.read().then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

async function parseMultipartForm(bytes: Uint8Array<ArrayBuffer>, contentType: string | null) {
  if (!contentType?.toLocaleLowerCase("en").startsWith("multipart/form-data;")) return null;
  try {
    return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    return null;
  }
}

function validatedUpload(form: FormData): IdentityUploadRequest {
  const identity: IdentityDocumentDeclaration = {
    firstName: textField(form, "firstName").trim(),
    lastName: textField(form, "lastName").trim(),
    birthDate: textField(form, "birthDate").trim(),
    identityNumber: textField(form, "identityNumber").trim(),
    tcDocumentNumber: textField(form, "tcDocumentNumber").trim(),
  };
  const fieldErrors: Record<string, string> = {};
  if (!identity.firstName) fieldErrors.firstName = "Adını yazmalısın.";
  if (!identity.lastName) fieldErrors.lastName = "Soyadını yazmalısın.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(identity.birthDate)) {
    fieldErrors.birthDate = "Doğum tarihini yıl-ay-gün olarak seç.";
  }
  if (!/^[1-9][0-9]{9}[02468]$/.test(identity.identityNumber)) {
    fieldErrors.identityNumber = "T.C. kimlik numarası 11 haneli olmalı.";
  }
  if (!identity.tcDocumentNumber) {
    fieldErrors.tcDocumentNumber = "Kimlik seri numarasını yazmalısın.";
  }

  const selfie = photoOf(form, "selfie");
  const front = photoOf(form, "front");
  const back = photoOf(form, "back");
  const together = photoOf(form, "together");
  if (!selfie) fieldErrors.selfie = "Yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("selfie", selfie));
  if (!front) fieldErrors.front = "Kimliğin ön yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("front", front));
  if (!back) fieldErrors.back = "Kimliğin arka yüzünün fotoğrafını seç.";
  else Object.assign(fieldErrors, photoErrors("back", back));
  if (!together) fieldErrors.together = "Kartın yüzünün altında olduğu fotoğrafı seç.";
  else Object.assign(fieldErrors, photoErrors("together", together));

  const photos = [selfie, front, back, together];
  if (
    photos.every((photo) => photo !== null)
    && photos.reduce((total, photo) => total + (photo?.size ?? 0), 0) > identityPhotoContentMaxBytes
  ) {
    fieldErrors.photos = identityPhotoUploadErrors.contentTooLarge;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: validationState(fieldErrors) };
  }

  return {
    ok: true,
    identity,
    photos: { selfie: selfie!, front: front!, back: back!, together: together! },
  };
}

function photoOf(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value !== null && typeof value !== "string" && value.size > 0 ? value : null;
}

function photoErrors(field: string, photo: File): Record<string, string> {
  if (photo.size > identityPhotoFileMaxBytes) {
    return { [field]: identityPhotoUploadErrors.fileTooLarge };
  }
  const extension = photo.name.split(".").pop()?.toLocaleLowerCase("tr");
  const mimeAllowed = photo.type.length === 0 || identityPhotoAllowedMimeTypes.has(photo.type);
  if (!extension || !identityPhotoAllowedExtensions.has(extension) || !mimeAllowed) {
    return { [field]: identityPhotoUploadErrors.unsupportedType };
  }
  return {};
}

function uploadTooLarge(): IdentityUploadRequest {
  return {
    ok: false,
    state: {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 413,
      fieldErrors: { photos: identityPhotoUploadErrors.contentTooLarge },
    },
  };
}

function uploadTimedOut(): IdentityUploadRequest {
  return {
    ok: false,
    state: {
      status: "error",
      errorCode: "IDENTITY_UPLOAD_TIMED_OUT",
      httpStatus: 408,
      fieldErrors: { photos: identityPhotoUploadErrors.timedOut },
    },
  };
}
