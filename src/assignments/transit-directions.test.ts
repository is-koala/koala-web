import { describe, expect, it } from "vitest";

import { transitDirections } from "./transit-directions";

describe("toplu taşımayla yol tarifi bağlantıları", () => {
  it("hedefi koordinatla, toplu taşıma kipinde ve API anahtarı olmadan kurar", () => {
    expect(transitDirections({ latitude: 41.081235, longitude: 29.008765 })).toEqual({
      google:
        "https://www.google.com/maps/dir/?api=1&destination=41.081235%2C29.008765&travelmode=transit",
      apple: "https://maps.apple.com/?daddr=41.081235%2C29.008765&dirflg=r",
    });
  });

  it("koordinatı altı ondalığa yuvarlar ve bilimsel gösterime düşmez", () => {
    // ~11 cm hassasiyet; uzun ondalık ya da `1e-7` biçimi URL'yi bozardı.
    expect(transitDirections({ latitude: 41.0812349999, longitude: 0.0000001 })?.google).toContain(
      "destination=41.081235%2C0&",
    );
    expect(transitDirections({ latitude: -33.8688, longitude: 151.2093 })?.apple).toBe(
      "https://maps.apple.com/?daddr=-33.8688%2C151.2093&dirflg=r",
    );
  });

  it("geçersiz ya da eksik koordinatta bağlantı üretmez", () => {
    for (const position of [
      null,
      undefined,
      {},
      { latitude: null, longitude: 29 },
      { latitude: 91, longitude: 29 },
      { latitude: 41, longitude: -180.5 },
      { latitude: Number.NaN, longitude: 29 },
      { latitude: "41.08", longitude: "29.00" },
    ]) {
      expect(transitDirections(position as never), JSON.stringify(position)).toBeNull();
    }
  });

  it("kullanıcının konumunu bağlantıya koymaz", () => {
    // Başlangıç noktası yok: harita bulunduğun yeri kendisi soruyor, konum
    // web'den hiçbir yere gitmiyor.
    const links = transitDirections({ latitude: 41, longitude: 29 })!;
    expect(links.google).not.toMatch(/origin|saddr/);
    expect(links.apple).not.toMatch(/saddr|origin/);
  });
});
