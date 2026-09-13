import { describe, expect, it } from "vitest";

import {
  appLinkPaths,
  buildAndroidAssociation,
  buildAppleAssociation,
  commaSeparatedValues,
} from "./associations";

// is-koala/koala: lib/product/router/app_link_destination.dart
// `AppLinkDestination.httpsPathPrefixes` — mobil bu listeyi flavor
// manifestleriyle karşılaştırıyor; burası da aynı listeyi web tarafında sabitler.
const mobileHttpsPathPrefixes = [
  "/hesap-dogrula",
  "/sifre-belirle",
  "/sifre-sifirla",
  "/eposta-onayla",
  "/payment/result",
  "/davet",
];

describe("uygulama bağlantısı ilişkilendirme belgeleri", () => {
  it("web yol listesi mobil AppLinkDestination önekleriyle birebir aynı", () => {
    expect([...appLinkPaths]).toEqual(
      mobileHttpsPathPrefixes.map((prefix) => `${prefix}*`),
    );
  });

  it("Apple belgesi yalnız kanonik karşılama yollarını uygulamaya bağlar", () => {
    const association = buildAppleAssociation("PREFIX.com.iskoala.koala");

    expect(association.applinks.details).toEqual([
      {
        appIDs: ["PREFIX.com.iskoala.koala"],
        components: appLinkPaths.map((path) => ({ "/": path })),
      },
    ]);
    expect(association.applinks.details[0].components).toContainEqual({
      "/": "/davet*",
    });
  });

  it("Android belgesi Play App Signing parmak izlerini yayımlar", () => {
    const association = buildAndroidAssociation(
      ["com.iskoala.koala"],
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

  it("Android belgesi her paket için aynı parmak izleriyle ayrı ifade üretir", () => {
    const association = buildAndroidAssociation(
      ["com.iskoala.koala.staging", "com.iskoala.koala"],
      ["AA:BB"],
    );

    expect(association.map((statement) => statement.target.package_name)).toEqual([
      "com.iskoala.koala.staging",
      "com.iskoala.koala",
    ]);
    for (const statement of association) {
      expect(statement.relation).toEqual([
        "delegate_permission/common.handle_all_urls",
      ]);
      expect(statement.target.namespace).toBe("android_app");
      expect(statement.target.sha256_cert_fingerprints).toEqual(["AA:BB"]);
    }
  });

  it("virgülle ayrılmış env değerini kırpar ve boş parçaları atar", () => {
    expect(commaSeparatedValues(" a , ,b,")).toEqual(["a", "b"]);
    expect(commaSeparatedValues("")).toEqual([]);
    expect(commaSeparatedValues(undefined)).toEqual([]);
  });
});
