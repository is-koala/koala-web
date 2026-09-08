# Koala Web

`iskoala.com` tanıtım, yasal metin ve mobil uygulamaya güvenli aktarım katmanı.

## Yerel geliştirme

Node 24 ve npm 11 kullanılır. `.env.example` dosyasını `.env.local` olarak
kopyalayıp `npm ci && npm run dev` çalıştır. Zorunlu `NEXT_PUBLIC_SITE_URL`
veya `NEXT_PUBLIC_APP_URL_SCHEME` eksikse build, hangi değerin eksik olduğunu
söyleyen Türkçe bir hatayla durur.

BFF katmanının sunucu tarafı değişkenleri `API_URL` ve `APP_VERSION`
sunucu açılışında doğrulanır: eksik `API_URL` ya da backend sürüm kapısının
okuyamayacağı bir `APP_VERSION` sunucuyu ilk istek gelmeden durdurur.
`API_URL` sırdır, `NEXT_PUBLIC_` öneki almaz ve image katmanına gömülmez;
yalnız çalışma ortamında tanımlanır.

Kalite kapısı: `npm run lint && npm run typecheck && npm test && npm run build`
ve ardından `npm run test:e2e`.

## Stil kararı

Tailwind CSS, küçük yardımcı sınıfları ve proje büyüdüğünde tutarlı responsive
kuralları aynı derleme hattında sunduğu için seçildi. Marka değişkenleri
`src/brand/tokens.ts`, logo olmadan çalışan kelime markası
`src/brand/Wordmark.tsx` içindedir. Logo geldiğinde yalnız
`src/brand/Wordmark.tsx`, `src/app/icon.tsx` ve
`src/app/opengraph-image.tsx` değişir.

## Uygulamaya aktarım

| Platform | Davranış |
| --- | --- |
| Android | Kullanıcı dokununca paket ve Play Store yedeği bulunan `intent://` bağlantısı açılır. |
| iOS | Otomatik yönlendirme veya zamanlayıcılı mağaza geçişi yapılmaz; kullanıcı uygulamayı ya da mağazayı açıkça seçer. |
| Masaüstü | Custom scheme denenmez; QR kod ve varsa mağaza bağlantısı gösterilir. |

`/sifre-belirle` kalıcı olarak 308 ile `/hesap-dogrula` adresine gider.
Backend kayıt bağlantısını yalnız `/hesap-dogrula` olarak üretiyor ve
`/sifre-belirle` adresine giden hiçbir bağlantı yok; parola belirleme adımı
`/hesap-dogrula` sayfasının kendisinde tamamlanıyor. Yönlendirme, daha önce
gönderilmiş e-postalar için duruyor.

## Dokploy dağıtımı

Dağıtım kaynağı GitHub `main` değil, backend ile aynı şekilde `v*` etiketidir.
Dokploy servisi repodaki çok aşamalı `Dockerfile` ile build edilir, container
3000 portunu açar ve sağlık kontrolü `/api/health` adresini kullanır. Build
ortamında kaynak kodun okuduğu `.env.example` public değerleri Docker build arg
olarak geçirilir; bunları yalnız container runtime ortamına eklemek yeterli
değildir. Runtime'da `API_URL`, `APP_VERSION` ve `GIT_SHA` tanımlanır.
`iskoala.com` servise bağlanır, TLS ve HTTPS zorlama açılır;
`www.iskoala.com` aynı servise bağlanır ve uygulama katmanında apex'e 301 döner.

PR birleştirme, `v*` etiketi yayımlama ve production deploy birbirinden ayrı
yayın kararlarıdır. CI doğrulamasından sonra yayımlanan etiket Dokploy'da yeni
dağıtımı tetikler.

## Uygulama bağlantısı doğrulaması

`/.well-known/apple-app-site-association` ve `/.well-known/assetlinks.json`
yanıtları yönlendirmesiz JSON üretir. `APPLE_APP_IDENTIFIER`, Apple Developer
portalındaki gerçek Application Identifier Prefix ile bundle kimliğinin
birleşimidir; Team ID olduğu varsayılmaz. Android parmak izi upload key'den
değil, Play Console'daki App Signing sertifikasından alınır. Değerler eksik veya
biçimsizse geçersiz ilişkilendirme belgesi yayımlamak yerine uç 503 döner.

Her alan adı kendi belgesini doğrudan HTTPS 200 ile sunmalıdır. Production,
staging ve geliştirme birbirinin uygulama kimliğini veya imza parmak izini
paylaşmaz.

## Google anahtarları

Web haritası yalnız `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` kullanır. Bu anahtar
tarayıcıya iner; bu nedenle staging ve production için ayrıdır, yalnız Maps
JavaScript API'ye yetkilidir ve exact HTTP referrer listesiyle kısıtlanır.
Production anahtarına localhost eklenmez. Places ve Geocoding web service
çağrıları backend'in sağlayıcıdan bağımsız adres uçlarında ve sunucu anahtarıyla
kalır.

Google Cloud'da günlük Maps JS kotası harcama sınırıdır; bütçe uyarısı yalnız
bildirim üretir. Gerçek anahtar hiçbir tracked dosyaya, issue'ya veya CI loguna
yazılmaz; `.env.example` değeri bilerek boştur.

## Wave 2 sağlayıcı kurulumu

Apple/Android ilişkilendirme değerleri, Maps kısıtları ve Sentry gizlilik
ayarları insan hesabı gerektirir. Tekrarlanabilir kontrol listesi için
`ops/setup-wave2-platforms.sh` çalıştırılır; sihirbaz gizli değerleri ekrana
basmadan yerel env ve GitHub Actions ayarlarına yönlendirir.

## Hata izleme

Sentry yalnız `NEXT_PUBLIC_SENTRY_DSN` tanımlandığında açılır. Varsayılan kişisel
veri gönderimi, tracing ve replay kapalıdır; olaylar istemci ve sunucuda ortak
bir scrubber'dan geçer. Source map yüklemek için CI'da `SENTRY_ORG`,
`SENTRY_PROJECT` ve gizli `SENTRY_AUTH_TOKEN` tanımlanır. Proje tarafındaki IP
saklama, sunucu scrubbing ve uyarı kanalı sihirbazla ayrıca doğrulanır.
