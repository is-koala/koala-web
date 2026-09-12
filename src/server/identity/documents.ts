import "server-only";

import { unstable_rethrow } from "next/navigation";

import { isNotFound } from "@/server/api/errors";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

export type IdentityDocumentDeclaration = {
  firstName: string;
  lastName: string;
  birthDate: string;
  identityNumber: string;
  tcDocumentNumber: string;
};

export type IdentityReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CurrentIdentityReview = {
  status: IdentityReviewStatus;
  rejectionReason: string | null;
};

type IdentityReviewDto = {
  status?: string | null;
  rejectionReason?: string | null;
};

const reviewStatuses = new Set<IdentityReviewStatus>(["PENDING", "APPROVED", "REJECTED"]);

/**
 * `POST /users/me/identity-documents` — multipart `identity` + `front` + `back`.
 *
 * Kimlik parçası `@RequestPart("identity")` için `application/json` olmak
 * zorunda; düz metin Spring'in `VerifyIdentityDto` çözümlemesini düşürür.
 * Dosya adları `uploadValidator`'ın uzantı kontrolü için olduğu gibi kalır.
 */
export async function submitIdentityDocuments(
  identity: IdentityDocumentDeclaration,
  front: File,
  back: File,
): Promise<void> {
  const body = new FormData();
  body.append(
    "identity",
    new Blob(
      [
        JSON.stringify({
          firstName: identity.firstName,
          lastName: identity.lastName,
          birthDate: identity.birthDate,
          tcIdentityNumber: identity.identityNumber,
          tcDocumentNumber: identity.tcDocumentNumber,
        }),
      ],
      { type: "application/json" },
    ),
  );
  body.append("front", front);
  body.append("back", back);
  await apiRequest(backendPaths.identityDocuments, { method: "POST", body });
}

/**
 * `GET /users/me/identity-documents` — oturum sahibinin son incelemesi.
 *
 * 404 `IDENTITY_DOCUMENTS_NOT_FOUND` henüz yükleme yok demektir; form
 * çizilir. Öbür hatalar yutulmaz. TCKN bu dönüşte yok: personel gerekçesi
 * ve durum kapı için yeter, kimlik numarası log yüzeyine çıkmasın.
 */
export async function getCurrentIdentityReview(): Promise<CurrentIdentityReview | null> {
  try {
    const dto = await apiRequest<IdentityReviewDto | null>(backendPaths.identityDocuments, {
      cache: "no-store",
    });
    const status = reviewStatuses.has(dto?.status as IdentityReviewStatus)
      ? (dto!.status as IdentityReviewStatus)
      : null;
    if (status === null) return null;
    const reason = dto?.rejectionReason?.trim() ?? "";
    return { status, rejectionReason: reason.length > 0 ? reason : null };
  } catch (error) {
    unstable_rethrow(error);
    if (isNotFound(error) && error.errorCode === "IDENTITY_DOCUMENTS_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}
