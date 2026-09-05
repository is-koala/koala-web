import { describe, expect, it } from "vitest";
import { legalRegistry } from "./registry";

describe("yasal metin kayıt defteri", () => {
  it("backenddeki beş sözleşme tipini sürümlü URL'lerle eşler", () => {
    expect(Object.keys(legalRegistry).sort()).toEqual([
      "COMMERCIAL_MESSAGE",
      "DISTANCE_SERVICE_CONTRACT",
      "EXPLICIT_CONSENT",
      "PRIVACY_POLICY",
      "TERMS_OF_SERVICE",
    ]);

    for (const entry of Object.values(legalRegistry)) {
      expect(entry.currentUrl).toMatch(/^\/[a-z-]+(?:#[a-z-]+)?$/);
      expect(entry.versionedUrl).toMatch(/^\/[a-z-]+\/v\/1\.0(?:#[a-z-]+)?$/);
    }
  });
});
