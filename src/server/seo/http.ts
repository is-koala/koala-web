import "server-only";

import { ApiError } from "@/server/api/errors";
import type { SitemapCacheWindow } from "@/server/seo/sitemap";

const publicErrorStatuses = new Set([400, 404, 429]);

/** Sitemap route'larında backend hata ayrıntısını sızdırmadan HTTP anlamını korur. */
export function sitemapErrorResponse(error: unknown): Response {
  const status =
    error instanceof ApiError && publicErrorStatuses.has(error.status) ? error.status : 503;
  return sitemapStatusResponse(status, error instanceof ApiError ? error.retryAfter : null);
}

/** Route biçimi backend'e gitmeden reddedildiğinde aynı hata yüzeyini kullanır. */
export function sitemapStatusResponse(status: number, retryAfter: string | null = null): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  if (status === 429 && retryAfter !== null) headers.set("Retry-After", retryAfter);
  return new Response(errorBody(status), {
    status,
    headers,
  });
}

/** Başarılı XML ve bounded CDN politikasının iki sitemap route'unda ayrışmasını önler. */
export function sitemapXmlResponse(
  body: string,
  cache: SitemapCacheWindow | "no-store" = { freshSeconds: 300, staleSeconds: 300 },
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheHeader(cache),
    },
  });
}

function cacheHeader(cache: SitemapCacheWindow | "no-store"): string {
  if (cache === "no-store") return cache;
  const base = `public, max-age=${cache.freshSeconds}, s-maxage=${cache.freshSeconds}`;
  return cache.staleSeconds > 0
    ? `${base}, stale-while-revalidate=${cache.staleSeconds}`
    : base;
}

function errorBody(status: number): string {
  if (status === 400) return "Geçersiz site haritası isteği";
  if (status === 404) return "Bulunamadı";
  if (status === 429) return "Çok fazla site haritası isteği";
  return "Site haritası geçici olarak kullanılamıyor";
}
