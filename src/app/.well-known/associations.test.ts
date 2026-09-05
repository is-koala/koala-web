import { describe, expect, it } from "vitest";

import {
  appLinkPaths,
  buildAndroidAssociation,
  buildAppleAssociation,
} from "./associations";

describe("uygulama bağlantısı ilişkilendirme belgeleri", () => {
  it("Apple belgesi yalnız kanonik karşılama yollarını uygulamaya bağlar", () => {
    const association = buildAppleAssociation("PREFIX.com.iskoala.koala");

    expect(association.applinks.details).toEqual([
      {
        appIDs: ["PREFIX.com.iskoala.koala"],
        components: appLinkPaths.map((path) => ({ "/": path })),
      },
    ]);
  });

  it("Android belgesi Play App Signing parmak izlerini yayımlar", () => {
    const association = buildAndroidAssociation(
      "com.iskoala.koala",
      ["AA:BB", "CC:DD"],
    );

    expect(association).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.iskoala.koala",
          sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
        },
      },
    ]);
  });
});
