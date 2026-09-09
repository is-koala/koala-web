/**
 * Backend'den gelen adreslerin DOM'a yazılmadan önce geçtiği kapı.
 *
 * Modül bilerek saf ve `server-only` işareti taşımıyor: aynı adresler hem
 * sunucuda çizilen kartlarda hem `"use client"` bileşenlerinde kullanılıyor.
 *
 * Üç ayrı kapı var çünkü site içi gezinme, harici `href` ve görsel `src`
 * aynı URL biçimini kabul etmiyor. `safeInternalPath` yalnız aynı origin'de
 * kalan mutlak yolları çözüyor; diğer iki kapı `allowedProtocols` üzerinden
 * yalnız mutlak `http`/`https` adreslerini tanıyor. Üçü de tanımadığı adrese
 * `null` diyor — çağıran o `null`'a bakıp kendi boş durumunu çiziyor.
 */
const allowedProtocols = new Set(["http:", "https:"]);

/** Site içi yolları çözerken kullanılan, gerçekte var olmayan origin. */
const internalProbeOrigin = "https://koala.invalid";

/**
 * Router/proxy zincirlerinin birden çok kez çözebileceği kodlamalara karşı
 * bakılan üst sınır. Sınırdan sonra hâlâ `%XX` varsa kabul etmek yerine kapalı
 * kalırız; böylece yeni bir decode katmanı denetimi aşamaz.
 */
const maxInternalPathDecodings = 3;
const encodedOctetPattern = /%[0-9a-f]{2}/i;
const unsafePathCharacterPattern = /[\\\u0000-\u001f\u007f]/;

/** Sorgu ve fragment veri olabilir; origin yorumunu değiştiren bölüm yalnız yoldur. */
function pathPart(value: string): string {
  const queryAt = value.indexOf("?");
  const hashAt = value.indexOf("#");
  const end = [queryAt, hashAt]
    .filter((index) => index >= 0)
    .reduce((earliest, index) => Math.min(earliest, index), value.length);
  return value.slice(0, end);
}

/** Ham ya da çözülmüş bir katman tek bir site içi yol biçiminde mi. */
function hasSafeInternalShape(value: string): boolean {
  const path = pathPart(value);
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !unsafePathCharacterPattern.test(path)
  );
}

/** Bir katmanı hem ham biçimiyle hem URL standardının normalize ettiği sonuçla denetler. */
function resolveInternalLayer(value: string): URL | null {
  if (!hasSafeInternalShape(value)) return null;

  try {
    const resolved = new URL(value, internalProbeOrigin);
    if (resolved.origin !== internalProbeOrigin) return null;
    if (!hasSafeInternalShape(resolved.pathname)) return null;
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Bir `href`'e yazılabilecek site içi mutlak yol; güvenli değilse `null`.
 *
 * Yalnız `startsWith("/")` yeterli değildir: `//host`, `/\\host` ve araya
 * sekme ya da satır sonu saklayan yollar tarayıcı tarafından dış origin'e
 * çözülebilir. Sahte origin ile gerçekten çözmek hem bu biçimleri eler hem de
 * DOM'a ham değer yerine tarayıcının kullanacağı normalleştirilmiş yolu verir.
 *
 * Girdi `unknown`, çünkü bu kapı tip denetiminin bulunmadığı çalışma zamanı
 * sınırında da kapalı kalmalıdır. Çağıran yalnız string kabul ediyor olsa bile
 * bozuk bir katalog girdisi tıklanabilir bir sink'e ulaşamaz.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let layer = value;
  let normalized: string | null = null;

  for (let decoded = 0; decoded <= maxInternalPathDecodings; decoded += 1) {
    const resolved = resolveInternalLayer(layer);
    if (!resolved) return null;
    normalized ??= `${resolved.pathname}${resolved.search}${resolved.hash}`;

    const path = pathPart(layer);
    if (!encodedOctetPattern.test(path)) return normalized;
    if (decoded === maxInternalPathDecodings) return null;

    try {
      // Yalnız yol çözülür: sorgu/fragment içindeki kodlanmış URL gibi veri
      // hedefin origin yorumuna katılmaz ve çıktıda birebir korunur.
      layer = `${decodeURIComponent(path)}${layer.slice(path.length)}`;
    } catch {
      return null;
    }
  }

  return null;
}

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
