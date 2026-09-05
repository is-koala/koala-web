<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# koala-web — ajanlar için çalışma kuralları

`iskoala.com`. Tanıtım sitesi **ve** zamanla mobil uygulamanın web paritesi.
Spec: [#1](https://github.com/is-koala/koala-web/issues/1)

## Bu sitenin asıl işi

Pazarlama değil, **e-posta karşılama katmanı**. Kullanıcıya giden her bağlantı
(hesap doğrulama, şifre belirleme, şifre sıfırlama) buraya düşer ve site
karar verir: mobilde uygulamaya mı, mağazaya mı, yoksa masaüstünde web'de mi
tamamlanacak. Tanıtım sayfaları bunun etrafındaki kabuk.

## Dil

Kullanıcıya görünen her metin **Türkçe**. Kod içi tanımlayıcılar (değişken,
bileşen, tip adları) İngilizce. Yorumlar Türkçe ve **neden**i anlatır, ne
yaptığını değil.

## Backend sözleşmesi

- Tek kaynak `https://api.iskoala.com`. Ortam değişkeni `NEXT_PUBLIC_API_BASE_URL`.
- **Her istek `X-App-Version` taşımalı.** Sunucunun filtresi başlığı
  taşımayan isteği geçiriyor — yani göndermemek zorunlu güncelleme kapısını
  tamamen devre dışı bırakır. Web için bu başlığın ne olacağı henüz karara
  bağlı; kararlaşana kadar yeni istek yolu ekleme.
- **Oturum cihaza bağlı.** Backend `X-Device-Id` ile oturumu cihaza bağlıyor
  ve yeni giriş o cihazın diğer oturumlarını kapatıyor. Tarayıcının "cihaz"ı
  ne olacağı da karara bağlı — kullanıcının telefonu ile tarayıcısı
  birbirinin oturumunu kapatmamalı.
- Yanıt zarfı: `{ success, data, message, errorCode, httpStatus, timeStamp }`.
  Hata yönlendirmesi **`errorCode`** ile yapılır, mesaj metniyle asla.
- Adres seçimi backend'in sağlayıcıdan bağımsız ağ geçidi üzerinden yapılır;
  Google anahtarı istemciye **hiç** girmez. Harita için ayrı, HTTP referrer
  kısıtlı bir Maps JavaScript anahtarı gerekir.

## Yapı

```
src/app/
  (marketing)/     tanıtım sayfaları — statik üretilir, SEO önemli
  (legal)/         yasal metinler — mobil uygulama da bunlara link verir
  (account)/       e-posta karşılama akışları — sunucu tarafı
```

Rota adları Türkçe ve kalıcıdır: `/hesap-dogrula`, `/sifre-belirle`,
`/sifre-sifirla`, `/eposta-onayla`, `/uygulamayi-ac`. Bunlar e-postalara
gömülecek; **değiştirmek eski e-postaları kırar.**

## Yasal metinler

`/kullanim-kosullari` ve `/gizlilik-politikasi` yalnız bu sitenin sayfaları
değil: mobil uygulamada bu iki bağlantı bugün `onTap: () {}` (ölü), ve
backend'deki `agreement_versions.contentUrl` alanının işaret edeceği bir yer
yok. Bu sayfalar o iki boşluğu da kapatıyor — URL'leri kalıcı kabul et.

## Görsel doğrulama

`npm run build` ve `next lint` yeşil olması **derlendiği** anlamına gelir,
doğru göründüğü anlamına gelmez. Görsel değişiklik yaptıysan bunu ekranda
doğrulamadığını **açıkça söyle** ve nelere bakılması gerektiğini yaz.

## Commit ve PR

Her dilim için ayrı branch, küçük commitler, PR. Conventional commit,
İngilizce imperative başlık, gövdede `Refs #NN`. CI geçmeden merge yok.
`git add .` kullanma — dosyaları açık yolla stage et.

## Sır yönetimi

`.env.local` Git'e girmez. `NEXT_PUBLIC_` önekli hiçbir değişkene sır konmaz
— o değerler tarayıcıya gider. Sunucu tarafı sırlar yalnız deploy ortamında.
