import { LoadingState } from "@/components/states";

/**
 * Bölümün kendi yükleniyor ekranı.
 *
 * Kabuk kökünde değil burada: kök bir Suspense sınırıyla sarıldığında HTTP
 * durumu 200'de kilitlenir ve `notFound()` artık 404 döndüremez (`AGENTS.md`).
 * Bu segment `notFound()` çağırmıyor ve yalnız kendi altını sarıyor.
 */
export default function Loading() {
  return <LoadingState label="İlan formu hazırlanıyor…" />;
}
