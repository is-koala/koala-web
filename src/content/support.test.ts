import { describe, expect, it } from "vitest";

import { controllerIdentity, supportContent } from "./support";

describe("veri sorumlusu kimliği", () => {
  it("yasal metinlerde olmayan tescilli unvanı veya sokak adresini uydurmaz", () => {
    expect(controllerIdentity.publicName).toBe("Koala");
    expect(controllerIdentity.email).toBe("info@iskoala.com");
    expect(controllerIdentity.kvkkApplicationEmail).toBe("info@iskoala.com");
    expect(controllerIdentity.postalAddress).toBeNull();
    expect(controllerIdentity.legalTitlePending).toContain("hukuk incelemesi");
    expect(controllerIdentity.postalAddressPending).toContain("Tebligat adresi");
  });

  it("KVKK başvuru adresini iletişim ve aydınlatma yollarına bağlar", () => {
    expect(controllerIdentity.kvkkApplicationPath).toBe("/iletisim");
    expect(controllerIdentity.kvkkNoticePath).toBe("/kvkk-aydinlatma");
    expect(supportContent.topics.map((topic) => topic.value)).toEqual([
      "destek",
      "kvkk",
      "sikayet",
      "diger",
    ]);
  });
});
