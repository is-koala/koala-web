import { describe, expect, it } from "vitest";

import { mapsJavaScriptUrl } from "./maps";

describe("Maps JavaScript yüklemesi", () => {
  it("anahtar boşken betik adresi üretmez", () => {
    expect(mapsJavaScriptUrl("")).toBeNull();
    expect(mapsJavaScriptUrl("   ")).toBeNull();
  });

  it("Places veya Geocoding kütüphanesini yüklemez", () => {
    // Referrer kısıtlı tarayıcı anahtarı sunucu API'lerine açılmasın diye
    // betik yalnız karo çizimi için iner (`README.md`, is-koala/koala-web#28).
    const url = mapsJavaScriptUrl("test-key");

    expect(url).toBe(
      "https://maps.googleapis.com/maps/api/js?key=test-key&v=weekly&loading=async",
    );
    expect(url).not.toMatch(/libraries=/i);
    expect(url).not.toMatch(/places/i);
    expect(url).not.toMatch(/geocod/i);
  });
});
