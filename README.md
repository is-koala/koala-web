# Koala Web

`iskoala.com` tanıtım, yasal metin ve mobil uygulamaya güvenli aktarım katmanı.

## Yerel geliştirme

Node 24 ve npm 11 kullanılır. `.env.example` dosyasını `.env.local` olarak
kopyalayıp `npm ci && npm run dev` çalıştır. Zorunlu `NEXT_PUBLIC_SITE_URL`
veya `NEXT_PUBLIC_APP_URL_SCHEME` eksikse build, hangi değerin eksik olduğunu
söyleyen Türkçe bir hatayla durur.

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
| iOS | Otomatik yönlendirme yapılmaz; dokunuştan sonra sayfa görünür kalırsa yaklaşık 1,5 saniyede mağaza yedeği gösterilir. |
| Masaüstü | Custom scheme denenmez; QR kod ve varsa mağaza bağlantısı gösterilir. |

`/sifre-belirle`, ayrı backend akışı oluşana kadar geçici olarak 308 ile
`/hesap-dogrula` adresine gider. Bu yönlendirme yeni akışın sahibi tarafından
ayrılacaktır.

## Dokploy dağıtımı

Dağıtım kaynağı GitHub `main` değil, backend ile aynı şekilde `v*` etiketidir.
Dokploy servisi repodaki çok aşamalı `Dockerfile` ile build edilir, container
3000 portunu açar ve sağlık kontrolü `/api/health` adresini kullanır. Build
ortamında `.env.example` içindeki public değerler; runtime'da `APP_VERSION` ve
`GIT_SHA` tanımlanır. `iskoala.com` servise bağlanır, TLS ve HTTPS zorlama
açılır; `www.iskoala.com` aynı servise bağlanır ve uygulama katmanında apex'e
301 döner.

PR birleştirme, `v*` etiketi yayımlama ve production deploy birbirinden ayrı
yayın kararlarıdır. CI doğrulamasından sonra yayımlanan etiket Dokploy'da yeni
dağıtımı tetikler.
