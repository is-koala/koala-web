import { identityChipPaUnavailableResponse } from "@/server/identity/chip-pa-unavailable";

export const dynamic = "force-dynamic";

/** `POST /users/me/identity-verification` — tarayıcı çip kanıtı üretemez. */
export function POST() {
  return identityChipPaUnavailableResponse();
}
