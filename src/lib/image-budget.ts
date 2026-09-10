/**
 * `next/image` çıktı bütçesi.
 *
 * İlan listesi/galeri kapakları hâlâ düz `<img>`: depolama kökeni
 * `images.remotePatterns`'e girmeden optimize edici onları reddeder
 * (is-koala/koala-web#35). Bütçe yine de burada duruyor ki #35 geldiğinde
 * 3840px WebP'siz bir türetime geri dönülmesin.
 */
export const imageBudget = {
  formats: ["image/avif", "image/webp"] as Array<"image/avif" | "image/webp">,
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};
