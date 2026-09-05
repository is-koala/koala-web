import {
  associationResponse,
  buildAndroidAssociation,
  isAndroidPackageName,
  isSha256Fingerprint,
  unavailableAssociationResponse,
} from "../associations";

export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_APP_LINKS_PACKAGE_NAME?.trim();
  const fingerprints = process.env.ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS
    ?.split(",")
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);

  if (
    !packageName ||
    !isAndroidPackageName(packageName) ||
    !fingerprints?.length ||
    fingerprints.some((fingerprint) => !isSha256Fingerprint(fingerprint))
  ) {
    return unavailableAssociationResponse();
  }

  return associationResponse(buildAndroidAssociation(packageName, fingerprints));
}
