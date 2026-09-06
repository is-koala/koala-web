import { describe, expect, it } from "vitest";

import { addressDraftErrors, addressWriteBody, readAddressWrite } from "./write";
import type { AddressDraft } from "./contract";

const istanbul = { id: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50", name: "İstanbul" };
const besiktas = { id: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51", name: "Beşiktaş" };
const turkiye = { id: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52", name: "Türkiye", code: "TR" };

function draft(overrides: Partial<AddressDraft> = {}): AddressDraft {
  return {
    country: turkiye,
    city: istanbul,
    district: besiktas,
    components: {
      neighborhood: "Levent",
      thoroughfare: "Büyükdere Caddesi",
      siteName: "",
      block: "",
      buildingName: "",
      buildingNumber: "12",
      floor: "",
      unitNumber: "",
      postalCode: "34330",
      additionalDirections: "",
    },
    position: { latitude: 41.0812345678, longitude: 29.0087654321 },
    source: "AUTOCOMPLETE_CONFIRMED",
    candidateToken: "aday-token-yer-tutucu",
    attribution: "Google Maps",
    needsReview: false,
    ...overrides,
  };
}

describe("AddressWriteV2 gövdesi", () => {
  it("yalnız sözleşmedeki alanları taşır ve boş bileşenleri hiç göndermez", () => {
    // Backend bilinmeyen alanı yok saymıyor, hata fırlatıyor (`rejectUnknownField`).
    expect(addressWriteBody(draft())).toEqual({
      countryId: turkiye.id,
      cityId: istanbul.id,
      districtId: besiktas.id,
      components: {
        neighborhood: "Levent",
        thoroughfare: "Büyükdere Caddesi",
        buildingNumber: "12",
        postalCode: "34330",
      },
      position: {
        latitude: 41.081235,
        longitude: 29.008765,
        source: "AUTOCOMPLETE_CONFIRMED",
      },
      candidateToken: "aday-token-yer-tutucu",
    });
  });

  it("kullanıcı pini onayladığında aday tokenını hiç göndermez", () => {
    // `verifyAndConsume`: USER_CONFIRMED_PIN ile gelen token doğrudan reddediliyor.
    const body = addressWriteBody(draft({ source: "USER_CONFIRMED_PIN" }));

    expect(body?.position.source).toBe("USER_CONFIRMED_PIN");
    expect(body && "candidateToken" in body).toBe(false);
  });

  it("ters çözümlenen adayda tokenı korur", () => {
    const body = addressWriteBody(draft({ source: "REVERSE_GEOCODE_CONFIRMED" }));

    expect(body?.candidateToken).toBe("aday-token-yer-tutucu");
    expect(body?.position.source).toBe("REVERSE_GEOCODE_CONFIRMED");
  });

  it("eksik ya da sözleşme dışı taslakta gövde üretmez", () => {
    expect(addressWriteBody(draft({ position: null }))).toBeNull();
    expect(addressWriteBody(draft({ district: null }))).toBeNull();
    expect(
      addressWriteBody(
        draft({ components: { ...draft().components, postalCode: "3433" } }),
      ),
    ).toBeNull();
    // Hizmet alanı dışındaki konum backend'e hiç gitmez.
    expect(
      addressWriteBody(draft({ position: { latitude: 39.92077, longitude: 32.85411 } })),
    ).toBeNull();
  });

  it("hizmet alanı dışını ham 400 yerine anlaşılır cümleyle anlatır", () => {
    const errors = addressDraftErrors(
      draft({ position: { latitude: 39.92077, longitude: 32.85411 } }),
    );

    expect(errors.position).toBe("Koala şu anda yalnızca İstanbul'da hizmet veriyor.");
  });

  it("kapı numarası yoksa site adını yeterli sayar", () => {
    const withSiteName = draft({
      components: { ...draft().components, buildingNumber: "", siteName: "Koala Plaza" },
    });

    expect(addressDraftErrors(withSiteName).buildingNumber).toBeUndefined();
    expect(addressWriteBody(withSiteName)?.components).toEqual({
      neighborhood: "Levent",
      thoroughfare: "Büyükdere Caddesi",
      siteName: "Koala Plaza",
      postalCode: "34330",
    });
  });
});

describe("form gövdesinden okunan adres", () => {
  function formWith(value: unknown) {
    const formData = new FormData();
    formData.set("address", JSON.stringify(value));
    return formData;
  }

  it("sözleşme dışı alanları backend'e hiç ulaştırmaz", () => {
    const body = addressWriteBody(draft())!;
    const smuggled = readAddressWrite(
      formWith({ ...body, isVerified: true, components: { ...body.components, secret: "x" } }),
    );

    expect(body).not.toBeNull();
    expect(smuggled).toEqual(body);
  });

  it("okunamayan ya da eksik gövdede adres üretmez", () => {
    const broken = new FormData();
    broken.set("address", "{");

    expect(readAddressWrite(broken)).toBeNull();
    expect(readAddressWrite(new FormData())).toBeNull();
    expect(readAddressWrite(formWith({ countryId: "sadece-ulke" }))).toBeNull();
  });

  it("kullanıcı pini uydurulmuş bir tokenla gelse de tokenı düşürür", () => {
    const body = addressWriteBody(draft())!;
    const forged = readAddressWrite(
      formWith({
        ...body,
        position: { ...body.position, source: "USER_CONFIRMED_PIN" },
        candidateToken: "uydurma-token",
      }),
    );

    expect(forged && "candidateToken" in forged).toBe(false);
  });
});
