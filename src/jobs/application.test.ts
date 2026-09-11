import { describe, expect, it } from "vitest";

import { applicationRemedy } from "./application";

describe("başvuru kapısı çözümleri", () => {
  it("adres eksiğini panel kayıt ekranına bağlar ve uygulamaya göndermez", () => {
    const remedy = applicationRemedy("APPLICANT_ADDRESS_REQUIRED");

    expect(remedy).toEqual({
      href: "/panel/adres",
      label: "Adresini ekle",
    });
    expect(remedy?.label.toLocaleLowerCase("tr")).not.toContain("uygulamada");
  });

  it("kimlik kapısını hâlâ uygulamaya bırakır", () => {
    expect(applicationRemedy("APPLICANT_IDENTITY_NOT_VERIFIED")).toEqual({
      href: "/uygulamayi-ac",
      label: "Kimlik doğrulamasını tamamla",
    });
  });
});
