/**
 * Backend'den gelen adreslerin DOM'a yazılmadan önce geçtiği kapı.
 *
 * Modül bilerek saf ve `server-only` işareti taşımıyor: aynı adresler hem
 * sunucuda çizilen kartlarda hem `"use client"` bileşenlerinde kullanılıyor.
 *
 * İki ayrı kapı var çünkü **iki ayrı sink var** ve tehlikeleri aynı değil.
 * Ortak sabit `allowedProtocols`: ikisinin de kabul ettiği tek şey mutlak
 * `http`/`https`, ve ikisi de tanımadığı adrese `null` diyor — çağıran o
 * `null`'a bakıp kendi boş durumunu çiziyor, "bozuk bağlantı" basmıyor.
 */
const allowedProtocols = new Set(["http:", "https:"]);

/**
 * Değer mutlak ve şeması tanınan bir adres mi.
 *
 * `new URL(...)` göreli yolu ayrıştıramaz ve atar; bu yüzden "mutlak mı"
 * sorusunun cevabı da buradan çıkıyor.
 */
function hasAllowedProtocol(value: string): boolean {
  try {
    return allowedProtocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Bir görsel adresi; kullanılamıyorsa `null`.
 *
 * `/` ile başlayan yol **geçiyor**: görseller aynı kökenden de servis
 * edilebiliyor ve göreli bir yol tarayıcıda hiçbir şema taşımıyor, yani
 * `javascript:` olma ihtimali yok. Bunu elemek çalışan görselleri kırardı.
 *
 * Kalanı için şema denetleniyor. Bu değer bir `background-image` /
 * `<img src>` içine giriyor: `javascript:` bir görsel sink'inde modern
 * tarayıcılarda çalışmaz, ama `data:` ile beslenen bir SVG çalışır, ve
 * elemek zaten hiçbir şey kaybettirmiyor — backend görselleri
 * `StorageUrlResolver.urlFor` ile mutlak `https` adrese çeviriyor.
 */
export function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  return hasAllowedProtocol(value) ? value : null;
}

/**
 * Bir `href`'e yazılacak bağlantı; şeması tanınmıyorsa `null`.
 *
 * Görselden **ayrı duruyor ve göreli yolu kabul etmiyor**, çünkü buradaki
 * tehlike başka: `href` tıklanabilir bir sink ve `javascript:` şeması orada
 * gerçekten çalışır — backend'den gelen bir metin doğrudan yazılırsa
 * tıklamayla tetiklenen bir XSS yüzeyi açar. `target` ve `rel` bunu
 * kapatmıyor; onlar açılan sayfanın bu sekmeye erişimini kısıtlıyor,
 * adresin şemasını değil.
 *
 * Göreli yolun elenmesi bir kayıp değil: bu kapıdan geçen alanları
 * (`cvUrl` gibi) backend `StorageUrlResolver.urlFor` ile her zaman mutlak
 * bir adrese çeviriyor. Bir gün aynı kökenden bir bağlantı gerekirse onu
 * `app-routes.ts` yazar, backend'in metni değil.
 */
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  return hasAllowedProtocol(value) ? value : null;
}
