export type Mascot = "employer" | "worker";

/**
 * Boş durum ve karşılama maskotları.
 *
 * Kaynak `assets/images/koala_business.png` / `koala_worker.png`
 * (853×1280); `public/brand/*-bos.webp` kenar boşluğu kırpılıp 300 piksel
 * yüksekliğe indirilmiş kopyaları (~15 KB), yani 150 piksellik gösterimin
 * 2× hâli. `next/image` **bilerek yok**: `EmptyState` istemci formlarının
 * içinden de çiziliyor ve `next/image` o yoldan tanıtım sayfalarının betik
 * bütçesine ~10 KB ekliyordu (ilan ayrıntısı 256 KB sınırını aşıyordu).
 * Sabit ölçülü, önceden küçültülmüş bir dosya için optimize ediciye gerek yok.
 */
const mascots: Record<Mascot, { src: string; width: number; height: number }> = {
  employer: { src: "/brand/maskot-isveren-bos.webp", width: 220, height: 300 },
  worker: { src: "/brand/maskot-calisan-bos.webp", width: 200, height: 300 },
};

export function MascotImage({
  mascot,
  height,
  className,
}: {
  mascot: Mascot;
  /** Gösterim yüksekliği; genişlik orandan türer, düzen kaymaz. */
  height: number;
  className?: string;
}) {
  const source = mascots[mascot];
  const width = Math.round((source.width / source.height) * height);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- yukarıdaki not: sabit, küçük dosya; optimize edici betik bütçesini aşırıyor.
    <img
      className={className}
      src={source.src}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
}
