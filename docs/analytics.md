# Karşılama ölçümleme sözleşmesi

Ölçümleme politika sürümü `1.1` için varsayılan olarak kapalıdır. Tarayıcı
yalnız açık rızadan sonra aynı origin'deki `/api/analytics/events` ucuna olay
gönderir. Uç yalnız `event` ve `platform` alanlarını kabul eder; ek alan içeren
gövdeleri reddeder. Böylece token, atama kimliği, e-posta ve serbest metin olay
zarfına giremez.

## Olaylar

| Olay | Anlamı |
| --- | --- |
| `handoff_viewed` | Karşılama sayfası rıza varken görüntülendi. |
| `deep_link_attempted` | Kullanıcı uygulamayı açma düğmesine dokundu. |
| `app_opened` | Denemeden sonra sayfa görünmez oldu; uygulamaya geçiş sinyali. |
| `store_fallback` | Kullanıcı mağaza bağlantısını kendisi seçti. |
| `desktop_fallback` | Masaüstünde QR/form devamı gösterildi. |

`platform` yalnız `ios`, `android` veya `desktop` olabilir. Uygulamaya geçiş
oranı platform bazında `app_opened / deep_link_attempted` olarak izlenir;
mağaza ve masaüstü sonuçları ayrı sayaçtır. `app_opened` bir tarayıcı
görünürlük sinyalidir, finansal veya kimlik doğrulama sonucu değildir. Yalnız
uygulama denemesinden sonra sayfa en az bir saniye görünmez kaldığında yazılır.
Başka bir sayfaya veya mağazaya giden `pagehide` olayı bekleyen sinyali iptal
eder.

Public olay ucu istemci başına dakikada 30, çalışan süreç başına toplam 600 zarf
kabul eder ve bellekte en fazla 2.000 geçici istemci kovası tutar. Kota aşımı
`429` ve `Retry-After` döndürür; ölçüm en iyi çaba niteliğindedir ve ürün akışını
engellemez.

Üretimde `koala_handoff_metric` türündeki yapılandırılmış loglar stdout'a ve
Sentry Logs'a gider; gözlemleme panosunda sayaç ve oran metriğine dönüştürülür.
Sentry filtresi bu loglarda yalnız olay ile platformu bırakır. Ham URL, query
string, istemci IP'si veya User-Agent loga eklenmez.
