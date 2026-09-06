/**
 * Arama motorlarına kapalı rotalar.
 *
 * Liste iki yerden okunuyor — `next.config.ts` yanıt başlıkları ve
 * `src/app/robots.ts` — ve ayrıştıklarında bir rota yalnız birinde kapanır:
 * robots.txt'te görünmeyen ama başlığı olan (ya da tersi) bir adres sessizce
 * indekslenebilir. Dosya yol takma adı (`@/`) kullanmaz, çünkü
 * `next.config.ts` onu göreli yoldan okuyor.
 */
export const privateRoutes = [
  "/giris",
  "/cikis",
  "/kayit",
  "/sifre-unuttum",
  "/hesap-dogrula",
  "/sifre-belirle",
  "/sifre-sifirla",
  "/eposta-onayla",
  "/uygulamayi-ac",
  "/payment/result",
] as const;
