/**
 * Arama motorlarına kapalı rotalar.
 *
 * Liste iki yerden okunuyor — `next.config.ts` yanıt başlıkları ve
 * `src/app/robots.ts` — ve ayrıştıklarında bir rota yalnız birinde kapanır:
 * robots.txt'te görünmeyen ama başlığı olan (ya da tersi) bir adres sessizce
 * indekslenebilir. Dosya yol takma adı (`@/`) kullanmaz, çünkü
 * `next.config.ts` onu göreli yoldan okuyor.
 */

type PrivateRouteDescriptor =
  | { readonly kind: "exact"; readonly path: string }
  | { readonly kind: "tree"; readonly path: string }
  | {
      readonly kind: "parameterized";
      readonly headerSource: string;
      readonly robotsRule: string;
    };

/**
 * Private yol kayıtlarının tek doğruluk kaynağı.
 *
 * İki tüketici aynı yolu farklı sözdizimleriyle yazıyor:
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
 *
 * Parametreli rota iki gösterimi aynı kayıtta zorunlu tutar. `:assignmentId`
 * Next'in yol parametresidir; robots.txt bunu anlamaz ve crawler tarafında
 * gerçek URL'yi eşleştiren `*` kalıbı gerekir.
 */
export const privateRouteDescriptors = [
  { kind: "exact", path: "/giris" },
  { kind: "exact", path: "/cikis" },
  { kind: "exact", path: "/kayit" },
  { kind: "exact", path: "/sifre-unuttum" },
  { kind: "exact", path: "/hesap-dogrula" },
  { kind: "exact", path: "/sifre-belirle" },
  { kind: "exact", path: "/sifre-sifirla" },
  { kind: "exact", path: "/eposta-onayla" },
  { kind: "exact", path: "/uygulamayi-ac" },
  { kind: "exact", path: "/kimlik-dogrula" },
  { kind: "exact", path: "/payment/result" },
  // Ticari e-postanın tek tıklık çıkış bağlantısı 90 gün geçerli bir token
  // taşıyor ve girişsiz bir tercihi kapatıyor (is-koala/koala-web#54).
  { kind: "exact", path: "/bildirim-tercihleri/cikis" },
  { kind: "exact", path: "/api/notification-preferences/unsubscribe" },
  // Rolü çözüp tercihlere yönlendiren adres; içerik taşımıyor ama dizine
  // girecek bir şeyi de yok.
  { kind: "exact", path: "/hesap/bildirimler" },
  { kind: "exact", path: "/isveren/adres" },
  { kind: "exact", path: "/panel/adres" },
  { kind: "tree", path: "/isveren" },
  { kind: "tree", path: "/panel" },
  { kind: "tree", path: "/davet" },
  { kind: "tree", path: "/api/disputes" },
  {
    kind: "parameterized",
    headerSource: "/api/payments/:assignmentId/result",
    robotsRule: "/api/payments/*/result",
  },
] as const satisfies readonly PrivateRouteDescriptor[];

/** Tek başına kapanan, alt yolu olmayan adresler. */
export const privateRoutes: readonly string[] = privateRouteDescriptors.flatMap((route) =>
  route.kind === "exact" ? [route.path] : [],
);

/** Kendisiyle birlikte altındaki her yolun kapandığı ağaçlar. */
export const privateRouteTrees: readonly string[] = privateRouteDescriptors.flatMap((route) =>
  route.kind === "tree" ? [route.path] : [],
);

/**
 * Gizli sayfa ve BFF yanıtlarının ortak tarayıcı güvenlik politikası.
 *
 * `Referrer-Policy: strict-origin`, `no-referrer` değil (is-koala/koala-web#199).
 * Fetch standardı `no-referrer` politikalı sayfadan gelen düz form POST'una
 * `Origin: null` yazdırıyor; server action'lı formlar hidrasyondan önce ve
 * JavaScript'siz tam olarak böyle gidiyor ve hem `src/proxy.ts` (403) hem
 * Next'in action CSRF denetimi (500) onu reddediyordu. `strict-origin` aynı
 * origin POST'una gerçek origin'i yazdırır; iki denetim de gevşemeden geçer.
 * `Referer` yalnız origin'i taşır: yol ve sorgu — tokenlı karşılama
 * adresleri, davet kimliği — hiçbir isteğe girmez. `same-origin` ve
 * `strict-origin-when-cross-origin` aynı origin isteğinde tam adresi (token
 * dahil) yazdığı için elendi; `null`'u CSRF denetimlerinde kabul etmek ise
 * sandbox iframe gibi her `null` kaynağa kapı açardı.
 */
export const privateResponseHeaders = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "strict-origin",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** `next.config.ts` başlık kurallarının kaynak kalıpları. */
export const privateHeaderSources: readonly string[] = [
  ...privateRouteDescriptors.flatMap((route) => {
    if (route.kind === "exact") return [route.path];
    if (route.kind === "tree") return [route.path, `${route.path}/:path*`];
    return [route.headerSource];
  }),
];

/** `robots.txt` içindeki `Disallow` satırları. */
export const privateDisallowRules: readonly string[] = [
  ...privateRouteDescriptors.flatMap((route) => {
    if (route.kind === "exact") return [route.path];
    if (route.kind === "tree") return [`${route.path}$`, `${route.path}/`];
    return [route.robotsRule];
  }),
];
