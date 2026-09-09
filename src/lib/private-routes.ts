/**
 * Arama motorlarına kapalı rotalar.
 *
 * Liste iki yerden okunuyor — `next.config.ts` yanıt başlıkları ve
 * `src/app/robots.ts` — ve ayrıştıklarında bir rota yalnız birinde kapanır:
 * robots.txt'te görünmeyen ama başlığı olan (ya da tersi) bir adres sessizce
 * indekslenebilir. Dosya yol takma adı (`@/`) kullanmaz, çünkü
 * `next.config.ts` onu göreli yoldan okuyor.
 */

/** Tek başına kapanan, alt yolu olmayan adresler. */
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

/**
 * Kendisiyle birlikte altındaki her yolun kapandığı ağaçlar.
 *
 * Ayrı bir liste, çünkü iki tüketici bir ağacı iki farklı biçimde yazıyor ve
 * ikisi de tek satırla yanlış yapılabiliyor:
 *
 * - `next.config.ts` yol kalıbı bekler; yalnız `/isveren` yazmak alt yolları
 *   başlıksız bırakır.
 * - robots.txt eşleşmesi **önek** temellidir; yalnız `Disallow: /isveren`
 *   yazmak `/isverenler` tanıtım sayfasını da düşürür. Bu yüzden ağaç iki
 *   satıra açılır: yolun bittiğini söyleyen `/isveren$` ve alt ağacı kapatan
 *   `/isveren/`.
 *
 * Liste yalnız oturumlu kabukları saymıyor: `/davet` de burada. Davet adresi
 * bir kimlik taşıyor ve o kimliği bilen herkes daveti okuyabiliyor
 * (`getInvitationById` sahiplik denetimi yapmıyor), yani adres arama
 * motoruna, `Referrer` başlığına ve önbelleğe hiç girmemeli. Kabuk olmadığı
 * için `app-routes.ts` kaydında karşılığı yok; ağaçların kabuk köklerini
 * **kapsadığı** ama onlardan ibaret olmadığı `app-routes.test.ts` içinde
 * yazılı.
 */
export const privateRouteTrees = ["/isveren", "/panel", "/davet", "/api/disputes"] as const;

/** `next.config.ts` başlık kurallarının kaynak kalıpları. */
export const privateHeaderSources: readonly string[] = [
  ...privateRoutes,
  ...privateRouteTrees.flatMap((root) => [root, `${root}/:path*`]),
];

/** `robots.txt` içindeki `Disallow` satırları. */
export const privateDisallowRules: readonly string[] = [
  ...privateRoutes,
  ...privateRouteTrees.flatMap((root) => [`${root}$`, `${root}/`]),
];
