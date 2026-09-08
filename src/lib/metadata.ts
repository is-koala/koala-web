import type { Metadata } from "next";

import { publicEnvironment } from "@/lib/env";

/**
 * Site kökünden mutlak adres.
 *
 * Dışa açık, çünkü kanonik adresi kuran **tek** yer burası olmalı. Aynı
 * sayfanın adresi iki koldan yayımlanıyor: `<link rel="canonical">` bunu
 * `pageMetadata` üzerinden yazıyor, yapısal verinin `url` alanı ise sayfanın
 * kendisinden geçiyor. İkisi ayrı ayrı `new URL(path, siteUrl)` kurduğunda
 * aradaki fark — sondaki eğik çizgi, farklı bir taban, kaçırılmış bir
 * segment — derleyiciye de teste de görünmüyordu; arama motoru ise iki
 * farklı adres okuyup sayfayı kendi kanonik seçimine bırakıyordu.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnvironment().siteUrl).toString();
}

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
  const url = absoluteUrl(path);
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
