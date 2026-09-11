import { identityChipPaUnavailableResponse } from "@/server/identity/chip-pa-unavailable";

export const dynamic = "force-dynamic";

/** `POST /users/me/identity-verification/challenge` — imza tarayıcıda yok. */
export function POST() {
  return identityChipPaUnavailableResponse();
}
