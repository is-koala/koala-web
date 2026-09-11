import { describe, expect, it } from "vitest";

import { canonicalAddressFrom } from "./read";

describe("AddressDto okuma", () => {
  it("görünen adresi, bileşenleri ve koordinatı taşır", () => {
    expect(
      canonicalAddressFrom({
        countryName: "Türkiye",
        cityName: "İstanbul",
        districtName: "Beşiktaş",
        components: {
          neighborhood: "Levent",
          thoroughfare: "Büyükdere Caddesi",
          buildingNumber: "12",
          postalCode: "34330",
        },
        displayAddress: "Büyükdere Caddesi No: 12, Levent",
        needsReview: false,
        position: { latitude: 41.081235, longitude: 29.008765, source: "USER_CONFIRMED_PIN" },
      }),
    ).toEqual({
      countryName: "Türkiye",
      cityName: "İstanbul",
      districtName: "Beşiktaş",
      components: {
        neighborhood: "Levent",
        thoroughfare: "Büyükdere Caddesi",
        buildingNumber: "12",
        postalCode: "34330",
      },
      displayAddress: "Büyükdere Caddesi No: 12, Levent",
      needsReview: false,
      position: { latitude: 41.081235, longitude: 29.008765 },
    });
  });

  it("okunamayan gövdeyi adres saymaz", () => {
    expect(canonicalAddressFrom(null)).toBeNull();
    expect(canonicalAddressFrom("Levent")).toBeNull();
  });
});
