import { describe, expect, it, vi } from "vitest";

vi.mock("@next/mdx", () => ({ default: () => (config: unknown) => config }));
vi.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: (config: unknown) => config,
}));

describe("Next sunucu action yükleme bütçesi", () => {
  it("kimlik yüklemesi ayrıldıktan sonra genel action sınırını büyütmez", async () => {
    const { default: nextConfig } = await import("../next.config");

    expect(nextConfig).toMatchObject({
      experimental: {
        serverActions: { bodySizeLimit: "11mb" },
      },
    });
  });
});

describe("site geneli Referer politikası", () => {
  it("her yanıta strict-origin basar; gizli rotalar da aynı değeri taşır", async () => {
    /*
     * Gizli rotalar `strict-origin` taşıyor (is-koala/koala-web#199) ama
     * politika belgeye yalnız sert yüklemede yerleşiyor: tanıtım sayfasından
     * istemci tarafı gezinmeyle `/panel/**` ya da `/davet/{id}`'e geçen
     * belge tarayıcı varsayılanında (`strict-origin-when-cross-origin`) kalıyor
     * ve aynı origin isteklerine tam adresi yazıyordu. Site genelinde aynı
     * politika bu boşluğu kapatıyor; çapraz origin davranışı (Maps anahtarının
     * referrer kısıtı dahil) zaten yalnız origin gönderiyordu, değişmiyor.
     */
    const { default: nextConfig } = await import("../next.config");
    const rules = await (nextConfig.headers as () => Promise<
      { source: string; has?: unknown; headers: { key: string; value: string }[] }[]
    >)();

    const siteWide = rules.find((rule) => rule.source === "/:path*" && rule.has === undefined);
    expect(siteWide?.headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin" });
    for (const rule of rules) {
      for (const header of rule.headers) {
        if (header.key === "Referrer-Policy") expect(header.value, rule.source).toBe("strict-origin");
      }
    }
  });
});
