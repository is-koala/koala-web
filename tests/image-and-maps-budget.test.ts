import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { imageBudget } from "@/lib/image-budget";

describe("görsel ve harita bütçesi", () => {
  it("next/image çıktısını AVIF/WebP ve sınırlı cihaz genişlikleriyle kısıtlar", () => {
    expect(imageBudget).toEqual({
      formats: ["image/avif", "image/webp"],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    });
    expect(readFileSync(join(process.cwd(), "next.config.ts"), "utf8")).toContain(
      "images: imageBudget",
    );
  });

  it("ilan listesi, ilan ayrıntısı ve kök yerleşim Maps JavaScript yüklemez", () => {
    // Harita seçici is-koala/koala-web#28; galeri kapakları #35'te kasıtlı
    // olarak `<img>` kaldı (depolama origin'i remotePatterns'te yok).
    // Bu kapı global bundle'a girmemesini tutar, picker'ı uygulamaz.
    const guarded = [
      "src/app/layout.tsx",
      "src/app/(marketing)/layout.tsx",
      "src/app/(marketing)/is-ilanlari/page.tsx",
      "src/components/job-search.tsx",
      "src/components/job-location-filter.tsx",
      // Harita kabuğu SDK'yı yalnız `next/dynamic` parçasında (`job-map.tsx`)
      // ister; kabuğun kendisi liste sayfasına giriyor ve temiz kalmalı.
      "src/components/job-map-view.tsx",
      "src/components/job-detail.tsx",
      "src/components/job-application-form.tsx",
    ];

    for (const file of guarded) {
      const contents = readFileSync(join(process.cwd(), file), "utf8");
      expect(contents, file).not.toMatch(/maps\.googleapis|maps\.gstatic|google\.maps/i);
    }
  });
});
