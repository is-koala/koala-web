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

  it("kimlik kapısını web aktarım ekranına bağlar", () => {
    expect(applicationRemedy("APPLICANT_IDENTITY_NOT_VERIFIED")).toEqual({
      href: "/kimlik-dogrula",
      label: "Kimlik doğrulamasını tamamla",
    });
  });

  it("başvuru sayfasını dönüş yolu olarak taşır", () => {
    expect(
      applicationRemedy(
        "APPLICANT_IDENTITY_NOT_VERIFIED",
        "/is-ilanlari/9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      ),
    ).toEqual({
      href: "/kimlik-dogrula?next=%2Fis-ilanlari%2F9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      label: "Kimlik doğrulamasını tamamla",
    });
  });
});
