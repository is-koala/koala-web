import { describe, expect, it } from "vitest";

import { writeFieldErrors } from "./write";

describe("AddressWriteV2 alan hataları", () => {
  it("kök DTO yolunu form alan adına çevirir", () => {
    expect(
      writeFieldErrors({
        "components.postalCode": "Posta kodu 5 haneli olmalı",
        "position.latitude": "Enlem geçersiz",
        countryId: "Ülke bulunamadı",
      }),
    ).toEqual({
      postalCode: "Posta kodu 5 haneli olmalı",
      position: "Enlem geçersiz",
      countryId: "Ülke bulunamadı",
    });
  });
});
