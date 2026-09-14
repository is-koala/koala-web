import Image from "next/image";
import Link from "next/link";

import head from "../../public/brand/head.png";
import wordmarkGreen from "../../public/brand/wordmark-green.png";
import wordmarkWhite from "../../public/brand/wordmark-white.png";

/* Piksel oranları elle yazılı: Vitest görsel içe aktarımını düz yol olarak
   çözüyor ve `width`/`height` alanları orada yok. */
const headRatio = 283 / 197;
const wordmarkRatio = 385 / 95;

/**
 * Marka imzası: maskot başı + "KOALA" yazısı.
 *
 * Yazı bir görsel, metin değil: wordmark'ın yüzü Folkra ve lisansı bu depoya
 * girmiyor. Görsel `assets/brand/lockup-green.png`'den çıkarıldı ve
 * `public/brand/` altında iki renkte duruyor; koyu zeminde beyazı seçilir.
 * Erişilebilir ad bağlantıda, görseller boş `alt` taşır. Görünen yükseklik
 * CSS'te (`.wordmark img`): dar ekranda küçülüyor ve o karar medya
 * sorgusunun; `height` burada yalnız oran ve yer ayırma için.
 *
 * `prefetch={false}`: bağlantı her sayfanın en üstünde duruyor ve görünür
 * olduğu anda ana sayfanın RSC yükünü **ve** istemci parçalarını (sekmeler,
 * form, görsel çalışma zamanı — ~11 KB) indiriyordu. İlan ayrıntısı bu
 * yüzden Lighthouse betik bütçesini (256 KB) aşıyordu; ana sayfaya dönüş
 * nadir bir gezinme, üzerine gelince hâlâ önceden yükleniyor.
 */
export function Wordmark({
  tone = "green",
  height = 30,
}: {
  tone?: "green" | "white";
  height?: number;
}) {
  const wordmark = tone === "white" ? wordmarkWhite : wordmarkGreen;
  const wordmarkHeight = Math.round(height * 0.72);
  return (
    <Link className="wordmark" href="/" aria-label="Koala ana sayfa" prefetch={false}>
      <Image
        src={head}
        alt=""
        height={height}
        width={Math.round(headRatio * height)}
        priority
      />
      <Image
        src={wordmark}
        alt=""
        height={wordmarkHeight}
        width={Math.round(wordmarkRatio * wordmarkHeight)}
        priority
      />
    </Link>
  );
}
