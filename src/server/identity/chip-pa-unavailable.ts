import "server-only";

import {
  identityChipPaUnavailableErrorCode,
  identityVerificationPath,
} from "@/identity/handoff";

/**
 * Web BFF çip PA kanıtı üretemez; gövdeyi okumak da kimlik alanlarını
 * log ve hata izleyici yüzeyine sokardı. 501, tarayıcıyı `/kimlik-dogrula`
 * aktarımına bırakır.
 */
export function identityChipPaUnavailableResponse(): Response {
  return Response.json(
    { errorCode: identityChipPaUnavailableErrorCode, httpStatus: 501 },
    {
      status: 501,
      headers: {
        "Cache-Control": "no-store",
        Location: identityVerificationPath,
      },
    },
  );
}
