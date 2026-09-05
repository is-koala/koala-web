import {
  associationResponse,
  buildAppleAssociation,
  isAppleAppIdentifier,
  unavailableAssociationResponse,
} from "../associations";

export const dynamic = "force-dynamic";

export function GET() {
  const appIdentifier = process.env.APPLE_APP_IDENTIFIER?.trim();
  if (!appIdentifier || !isAppleAppIdentifier(appIdentifier)) {
    return unavailableAssociationResponse();
  }

  return associationResponse(buildAppleAssociation(appIdentifier));
}
