import type { Metadata } from "next";

import { publicEnvironment } from "@/lib/env";

/**
 * Bir sayfanın başlığı, açıklaması ve kanonik adresi.
 *
 * `image` isteğe bağlı ve verilmediğinde **hiç yazılmıyor**: kökteki
 * `opengraph-image.tsx` sitenin varsayılan görselini zaten üretiyor, ve
 * burada boş bir `images` dizisi yazmak onu bastırırdı. Yalnız kendi kapak
 * görseli olan sayfalar (bugün ilan ayrıntısı) değeri geçiyor.
 */
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  image?: string | null,
): Metadata {
  const { siteUrl } = publicEnvironment();
  const url = new URL(path, siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}
