export const appLinkPaths = [
  "/hesap-dogrula*",
  "/sifre-belirle*",
  "/sifre-sifirla*",
  "/eposta-onayla*",
  "/payment/result*",
] as const;

export function isAppleAppIdentifier(value: string): boolean {
  return /^[A-Z0-9]{5,20}\.[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+){2,}$/.test(value);
}

export function isAndroidPackageName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){2,}$/.test(value);
}

export function isSha256Fingerprint(value: string): boolean {
  return /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value);
}

export function buildAppleAssociation(appID: string) {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appID],
          components: appLinkPaths.map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

export function buildAndroidAssociation(
  packageName: string,
  fingerprints: string[],
) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function associationResponse(body: unknown) {
  return Response.json(body, {
    headers: {
      "cache-control": "public, max-age=3600",
    },
  });
}

export function unavailableAssociationResponse() {
  return Response.json(
    { error: "app_association_not_configured" },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
