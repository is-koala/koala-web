import { describe, expect, it } from "vitest";

import {
  identityChipPaUnavailableErrorCode,
  identityHandoffHref,
  identityVerificationPath,
} from "./handoff";

describe("kimlik aktarım adresi", () => {
  it("kanonik ekranı /kimlik-dogrula olarak sabitler", () => {
    expect(identityVerificationPath).toBe("/kimlik-dogrula");
    expect(identityHandoffHref()).toBe("/kimlik-dogrula");
  });

  it("güvenli dönüş yolunu next olarak taşır", () => {
    expect(identityHandoffHref("/isveren/ilan/yeni")).toBe(
      "/kimlik-dogrula?next=%2Fisveren%2Filan%2Fyeni",
    );
    expect(identityHandoffHref("/is-ilanlari/9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60")).toBe(
      "/kimlik-dogrula?next=%2Fis-ilanlari%2F9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    );
  });

  it("dışarıya çıkan ya da bozuk bir next değerini düşürür", () => {
    expect(identityHandoffHref("https://evil.example/phish")).toBe("/kimlik-dogrula");
    expect(identityHandoffHref("//evil.example")).toBe("/kimlik-dogrula");
    expect(identityHandoffHref("/\\evil.example")).toBe("/kimlik-dogrula");
    expect(identityHandoffHref(null)).toBe("/kimlik-dogrula");
  });

  it.each([
    "/kimlik-dogrula?next=%2Fisveren%2Filan%2Fyeni",
    "/kimlik-dogrula?next=%2Fkimlik-dogrula%3Fnext%3D%252Fpanel",
    "/kimlik-dogrula#fotoğraflar",
    "/kimlik-dogrula?next=%2Fpanel#fotoğraflar",
  ])("%s self varyantını iç içe dönüş hedefine çevirmez", (returnPath) => {
    expect(identityHandoffHref(returnPath)).toBe("/kimlik-dogrula");
  });

  it("web'in çip PA üretemediğini tek errorCode ile söyler", () => {
    expect(identityChipPaUnavailableErrorCode).toBe("IDENTITY_CHIP_PA_NOT_AVAILABLE_ON_WEB");
  });
});
