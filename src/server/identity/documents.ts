import "server-only";

import { apiRequest } from "@/server/session/session";

export type IdentityDocumentDeclaration = {
  firstName: string;
  lastName: string;
  birthDate: string;
  identityNumber: string;
  tcDocumentNumber: string;
};

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
  await apiRequest("/users/me/identity-documents", { method: "POST", body });
}
