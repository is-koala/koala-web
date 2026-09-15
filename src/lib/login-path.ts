/**
 * Oturum gerektiren sayfalardan dönülecek giriş adresi. Sayfanın kendisi
 * #15 ile geliyor; oturum katmanı hedefi buradan okur ki iki yerde
 * ayrışmasın.
 *
 * `site.ts`'ten ayrı bir yaprak, çünkü `site.ts` menü için `app-routes`'u ve
 * yasal kataloğu taşıyor; hata kartının "Giriş yap" bağlantısı o ikisini
 * kök `error.tsx` paketine sürüklüyordu (is-koala/koala-web#177). `site.ts`
 * aynı değeri yeniden dışa aktarır; çağıranlar için tek kaynak değişmedi.
 */
export const loginPath = "/giris";
