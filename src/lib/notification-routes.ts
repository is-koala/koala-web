/**
 * Bildirim tercihlerine giden adresler; bağımlılıksız bir yaprak.
 *
 * Herkese açık çıkış sayfası (`/bildirim-tercihleri/cikis`) yalnız giriş
 * adresini okuyor ve `app-routes.ts`'in menü kaydını paketine taşımamalı.
 */

/**
 * Rolü bilmeyen bağlantıların indiği adres (is-koala/koala-web#54): oturum
 * varsa kullanıcıyı kendi kabuğunun tercihlerine, yoksa buraya dönecek
 * biçimde girişe gönderir (`src/app/hesap/bildirimler/route.ts`).
 */
export const notificationPreferencesEntryPath = "/hesap/bildirimler";

/** Hesap sayfasındaki tercih bölümünün çapası; yönlendirme buraya iner. */
export const notificationPreferencesAnchor = "bildirim-tercihleri";
