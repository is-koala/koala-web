import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  envelope,
  jsonResponse,
} from "../../../../../tests/support/session-cookies";
import {
  forbiddenAddressValues,
  jobDetailDto,
  jobDetailId,
} from "../../../../../tests/support/job-detail";

import Page, { generateMetadata } from "./page";

/**
 * İlan sayfasının adres yüzeyi — uçtan uca.
 *
 * Bu dosya `@/server/jobs/public-jobs`'u **taklit etmiyor**, ve fark tam olarak
 * budur: `page.test.tsx` çeviriciden geçmiş bir modelle çalışıyor, yani
 * ekranın kendi davranışını ölçüyor. Burada ölçülen şey zincirin tamamı —
 * backend'in ham gövdesi, BFF çeviricisi, sunucu bileşeni ve üretilen DOM.
 * Sızıntı bu üç halkanın herhangi birine eklenebilir; yalnız biri taklit
 * edilirse öbür ikisinde açılan bir delik görünmez.
 *
 * Fikstür `EXACT`: `JobAddressVisibility.protect` bu dalda gövdeyi
 * maskelemiyor ve `GET /jobs/{jobId}` kimlik istemiyor, yani anonim
 * ziyaretçinin gerçekten alabileceği yanıt bu (ADR-0003,
 * is-koala/koala-backend#7).
 */

vi.mock("./actions", () => ({ applyToJobAction: vi.fn() }));

describe("ilan sayfasının adres yüzeyi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://iskoala.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "koala");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, envelope(jobDetailDto()))),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("tam adres ve koordinat üretilen DOM'a hiç girmiyor", async () => {
    const { container } = render(await Page({ params: Promise.resolve({ jobId: jobDetailId }) }));
    const html = container.innerHTML;

    /*
     * Önce sayfanın gerçekten **çizildiği** ölçülüyor, sonra sızıntının
     * yokluğu. Sıra önemli: "içermiyor" biçimindeki bir iddia, sayfa hata
     * kartına düştüğünde de yeşil kalır — yani hiçbir şey çizmeyen bir
     * regresyon, gizlilik iddiasını kanıtlanmış gibi gösterirdi. Bu satır o
     * yalancı yeşili kapatıyor.
     */
    expect(html).toContain("Etkinlik görevlisi");
    expect(html).toContain('type="application/ld+json"');

    /*
     * `textContent` değil `innerHTML`: koordinat bir `data-` özniteliğine,
     * bir `alt` metnine ya da JSON-LD `<script>` gövdesine düşerse metin
     * okuması onu görmez ve iddia sızıntının üstünden geçerdi.
     */
    for (const secret of forbiddenAddressValues) {
      expect(html, secret).not.toContain(secret);
    }
  });

  it("ekranda konum olarak yalnız ilçe ve il duruyor", async () => {
    const { container } = render(await Page({ params: Promise.resolve({ jobId: jobDetailId }) }));

    expect(container.innerHTML).toContain("Kadıköy, İstanbul");
    // Kesinlik bayrağı okunuyor: `EXACT` yanıtta etiket "Konum", çünkü
    // gösterilen ilçe gerçekten ilanın ilçesi. Alanları bayrak seçmiyor.
    expect(container.innerHTML).toContain("Konum");
  });

  it("yapısal veri konum olarak yalnız ilçe, il ve ülke taşıyor", async () => {
    // Yapısal veri ekranda görünmeyen bir yüzey: buraya düşen bir adres
    // gözle bulunamaz, ama arama motoru onu makine tarafından okunabilir
    // biçimde yayımlar.
    const { container } = render(await Page({ params: Promise.resolve({ jobId: jobDetailId }) }));
    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script?.innerHTML ?? "{}") as Record<string, unknown>;

    expect(jsonLd.jobLocation).toEqual({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kadıköy",
        addressRegion: "İstanbul",
        addressCountry: "TR",
      },
    });
    expect(JSON.stringify(jsonLd)).not.toContain("streetAddress");
  });

  it("metadata da tam adresi taşımıyor", async () => {
    // Başlık ve açıklama `<head>`'e giriyor: gövdeyi temizleyip metadata'yı
    // atlamak, aynı veriyi arama sonucunda yayımlamak olurdu.
    const metadata = await generateMetadata({ params: Promise.resolve({ jobId: jobDetailId }) });

    const serialized = JSON.stringify(metadata);
    for (const secret of forbiddenAddressValues) {
      expect(serialized, secret).not.toContain(secret);
    }
    expect(metadata.title).toBe("Etkinlik görevlisi — Kadıköy, İstanbul");
  });
});
