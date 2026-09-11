/**
 * `next/image` çıktı bütçesi.
 *
 * İlan listesi/galeri kapakları hâlâ düz `<img>`: depolama kökeni
 * `STORAGE_PUBLIC_URL` ile ortamdan geliyor ve `images.remotePatterns`'e
 * tahmini bir desen eklemek yanlış origin'i kilitleyerek kırardı
 * (is-koala/koala-web#35). Bütçe yine de burada duruyor ki bir gün
 * next/image'e geçilirse 3840px WebP'siz bir türetime gidilmesin.
 */
export const imageBudget = {
  formats: ["image/avif", "image/webp"] as Array<"image/avif" | "image/webp">,
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};
