import {
  associationResponse,
  buildAndroidAssociation,
  commaSeparatedValues,
  isAndroidPackageName,
  isSha256Fingerprint,
  unavailableAssociationResponse,
} from "../associations";

export const dynamic = "force-dynamic";

export function GET() {
  const packageNames = commaSeparatedValues(
    process.env.ANDROID_APP_LINKS_PACKAGE_NAME,
  );
  const fingerprints = commaSeparatedValues(
    process.env.ANDROID_APP_LINKS_SHA256_CERT_FINGERPRINTS,
  );

  if (
    !packageNames.length ||
    packageNames.some((packageName) => !isAndroidPackageName(packageName)) ||
    !fingerprints.length ||
    fingerprints.some((fingerprint) => !isSha256Fingerprint(fingerprint))
  ) {
    return unavailableAssociationResponse();
  }

  return associationResponse(
    buildAndroidAssociation(packageNames, fingerprints),
  );
}
