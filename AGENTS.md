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

- HTTP çağrıları [ADR-0011](https://github.com/is-koala/koala-backend/blob/main/docs/adr/0011-web-client-architecture.md)
  uyarınca yalnız Next.js BFF üzerinden gider. Tarayıcı `api.iskoala.com` ile
  doğrudan konuşmaz; backend URL'si ve oturum tokenları public ortam
  değişkenlerine veya client bundle'a girmez.
- BFF her backend isteğine `X-App-Version`, `X-Client-Platform: web` ve
  tarayıcı profiline ait `X-Device-Id` başlıklarını ekler. Cihaz kimliği ile
  tokenlar `HttpOnly`, `Secure`, `SameSite=Lax` cookie'lerde tutulur.
- Tarayıcının doğrudan açtığı STOMP bağlantısı HTTP BFF sınırının tek
  istisnasıdır. Ana oturum tokenını JavaScript'e açma; kısa ömürlü STOMP
  kimliği backend'de hazır olana kadar web mesajlaşmasını bağlama.
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
  (uygulama)/      oturumlu kabuklar — /isveren ve /panel
```

Rota adları Türkçe ve kalıcıdır: `/hesap-dogrula`, `/sifre-belirle`,
`/sifre-sifirla`, `/eposta-onayla`, `/uygulamayi-ac`, `/davet/{invitationId}`.
Bunlar e-postalara gömülecek; **değiştirmek eski e-postaları kırar.**

`(uygulama)` altındaki iki kabuk oturum ister ve arama motorlarına kapalıdır:

- Kabuk layout'u `enterShell()` çağırır — önce `requireSessionForCurrentPath()`
  kapısı, sonra `React.cache()` ile paylaşılan `GET /users/me`. Kabuğun
  **altındaki her sayfa da** aynı çağrıyı yapar; kapı ucuz, profil paylaşılıyor
  ve sayfa kapısını layout'tan miras almıyor.
- Menü ve "henüz açılmadı" ekranları tek bir kayıttan çizilir:
  `src/lib/app-routes.ts`. Yeni bir bölüm önce oraya yazılır.
- Kabuk kökleri `src/lib/private-routes.ts` içindeki `privateRouteTrees`
  listesinde durur. `/isveren` tanıtım sayfası `/isverenler`'in **öneki**:
  robots.txt eşleşmesi önek temelli olduğu için ağaç `/isveren$` ve `/isveren/`
  olarak iki satıra açılır. Liste kabuklardan **ibaret değil**: kabuk altında
  olmayan ama adresi bir sır taşıyan rotalar da oraya girer — `/davet` bir
  davet kimliği taşıyor ve `GET /contact-invitations/{id}` sahiplik denetimi
  yapmadığı için o kimliği bilen herkes daveti okuyabiliyor.
  `next.config.ts` bu listeden `X-Robots-Tag`, `Referrer-Policy: no-referrer`
  ve `Cache-Control: no-store` basıyor; üçüncüsü yalnız `next start` ile
  görülür, `next dev` her dinamik yanıtın üzerine kendi
  `no-cache, must-revalidate` başlığını yazıyor, bu yüzden Playwright
  koşuları ona bakamaz.
- `loading.tsx`, yanındaki `page.tsx` `notFound()` çağırıyorsa konulamaz —
  kabuk kökünde de, bölümün kendi klasöründe de. Segment bir Suspense sınırıyla
  sarıldığında sayfa askıya girer girmez kabuk erken akıtılır, HTTP durumu
  200'de kilitlenir ve `notFound()` artık 404 döndüremez. Kural yalnız kabuk
  köküyle sınırlı değil: `notFound()` bir `await`'ten **sonra** çağrılıyorsa
  bölümün kendi `loading.tsx`'i de aynı sonucu verir.
  `src/app/route-shape.test.ts` ikisini de zorluyor. Yükleniyor durumu, karar
  verildikten **sonra** açılan bir iç `Suspense` ile verilir.
- Yetki kapıları tek katmanda: sözlük `src/lib/gates.ts`, karar
  `src/server/session/gates.ts`, metin `src/lib/errors.ts`
  (`gateNotice`). Kararlar `enterShell()`'in zaten okuduğu `GET /users/me`
  yanıtından türüyor — ikinci bir tur **yok**. Bir bölüm hangi kapıya
  ihtiyacı olduğunu `app-routes.ts` içindeki `requires` ile bildirir; liste
  zorunlu, kapısı olmayan bölüm boş liste yazar. Sayfa kapısını
  `ShellGate` ile sarar, layout'tan miras almaz: Next layout'ları kardeş
  rotalar arasında yeniden çalıştırmıyor, yani adrese bağlı bir kapı
  layout'ta bir gezinme sonra bayatlar.
- Kapının iki kipi var ve ikisi de arkasındaki eylemi kapatır; ayrıldıkları
  yer nedenin **nerede** okunduğu. `advisory` kabuğun her sayfasında duran
  kalıcı bir şerit (kimlik, fatura adresi); `blocking` eylemi devre dışı
  bırakıp gerekçeyi yanına yazar. Kip kapının kendi özelliği, çağıranın
  seçimi değil.
- **Kip yalnız `requires` ile bildirilen kapıları böler.** `gateRequirements`
  bir kabuğun ya da bölümün listesini kipine göre şeride ve engele ayırıyor.
  Bir **eylemin** kendi kararı (`viewerGates(...).individualJob`,
  `.companyCreation`, `corporateJobGate(...)`) böyle bölünmüyor: kapalıysa
  `blockedBy` listesinin tamamı o eylemi kapatır, kipe bakılmadan. Üç form da
  bunu yapıyor — `/isveren/ilan/yeni`, `/isveren/sirket/yeni` ve
  `/isveren/sirket/{companyId}/ilan/yeni`; kimlik kabuk düzeyinde `advisory`
  bir şerit ama backend ilan yayımlamayı ve şirket kurmayı kesin olarak
  reddettiği için eylemin kendisi `EmployerGate` ile kapanıyor.
  Ayrıldıkları yer `children`'ın çizilip çizilmediği ve ölçü **eksiği kimin
  kapatabildiği**: bireysel ilan formu çiziliyor, çünkü oradaki tek engel
  kimlik doğrulaması ve kullanıcı onu kendisi tamamlayabilir. Şirket kurma ve
  şirket adına ilan formlarında `children` hiç çizilmiyor — şirket onayı
  ekipte, yetkililik başka bir yöneticide, yani bekleyerek de olsa formu
  doldurmanın karşılığı yok ve her üç form tek kullanımlık bir adres kanıtı
  taşıyor (`candidateToken` 10 dakika yaşıyor): doldurulup reddedilen form o
  kanıtı yakar.
- **Şirket onayı kapısı bir ürün kuralı, güvenlik sınırı değil.**
  `company.isApproved()` koala-backend'in iş mantığında hiç okunmuyor;
  onaylanmamış şirket API'den ilan açabiliyor. Kapı istemcide duruyor ve
  `gateNotice("companyApproval").errorCodes` bunu boş listeyle söylüyor.
- **Rol değiştirici yok ve karar verilmeden eklenmez.** "Web'de rol
  değiştirilebilir mi?" sorusu ürün sahibinde (is-koala/koala-web#25).
  `isEmployer` yalnız kayıt anında yazılıyor, değiştirecek bir backend ucu
  yok, ve iki kabuk da bugün role göre değil yalnız oturuma göre kapalı.
  **Kayıt** sonrası hedef de bu yüzden `/` (`postRegistrationPath`,
  `src/lib/site.ts`): hangi kabuğa gidileceği #25'e bağlı. Girişin hedefi
  ayrı bir karar ve ayrı dosyada — `returnDestination`
  (`src/server/session/login-redirect.ts`) kullanıcıyı kapıya takıldığı
  sayfaya geri bırakıyor, dönülecek bir sayfa yoksa `/` kalıyor.
- **`isEmployer` şirket ilanının koşulu değil.** `JobManager.createIndividualJob`
  rolü ve kimliği arıyor, `createCorporateJob` yalnız şirketin yetkili
  listesinde olmayı. Bu yüzden şirket ilanı formu `/isveren/ilan/yeni`
  bölümünün altında değil kendi adresinde: o bölüm `employerRole` istiyor ve
  tek adres, davetle katılmış ama işveren olmayan bir yetkiliyi yapabildiği
  bir işten alıkoyardı.

### Telif satırında yıl yok

`SiteFooter` `© Koala` yazıyor, yıl **bilerek yok**. Tanıtım ve yasal sayfalar
statik üretildiği için yıl build anında HTML'e ve RSC payload'ına sabit sayı
olarak gömülüyordu: 1 Ocak'tan sonra, site yeniden deploy edilene kadar
ziyaretçi eski yılı görürdü. Ayrıca değeri build makinesinin `TZ`'sine bağlıydı.

Alternatifleri tartıldı ve elendi (is-koala/koala-web#90): `revalidate` yılda bir
değişen bir dize için tamamen statik 25 sayfaya çalışma zamanı ekliyordu, yılı
istemcide çizmek ise altbilgiyi istemci grafiğine sokup bugün **olmayan** bir
hidrasyon ayrışması yaratıyordu. Telif ihbarı yılı zorunlu tutmuyor, o yüzden
kaynak kurutuldu.

`src/components/site-footer.test.tsx` bunu tutuyor: altbilgi metninde dört
haneli hiçbir sayı olmamalı. Yılı geri eklemek zararsız görünür ve kusuru ancak
yıl dönümünde gösterir — test o tek satırı bugün durduruyor.

## Yasal metinler

`/kullanim-kosullari` ve `/gizlilik-politikasi` yalnız bu sitenin sayfaları
değil: mobil uygulamada bu iki bağlantı bugün `onTap: () {}` (ölü), ve
backend'deki `agreement_versions.contentUrl` alanının işaret edeceği bir yer
yok. Bu sayfalar o iki boşluğu da kapatıyor — URL'leri kalıcı kabul et.

## Görsel doğrulama

`npm run build` ve `npm run lint` yeşil olması **derlendiği** anlamına gelir,
doğru göründüğü anlamına gelmez. Görsel değişiklik yaptıysan bunu ekranda
doğrulamadığını **açıkça söyle** ve nelere bakılması gerektiğini yaz.

## Ekran durumları

Yeni veri ekranı yükleniyor, boş ve hata durumlarının üçünü de tanımlar.
Backend'in kullanıcıya yönelik ham hata metnine göre dallanma; davranışı
`errorCode` ile seç ve bilinmeyen kodda nötr Türkçe yedeği göster.

## Commit ve PR

Değişiklikler ayrı feature branch'te küçük Conventional Commit'lerle
gönderilir ve PR açılır. Doğrudan `main` dalına push edilmez; başlık İngilizce imperative,
gövde `Refs #NN` taşır ve `git add .` kullanılmaz.

**Kalite kapısı hem yerelde hem CI'da koşulur.** `.github/workflows/ci.yml`
artık self-hosted bir Raspberry Pi runner'ında çalışıyor (is-koala/koala-backend#91);
GitHub faturalandırmasına bağlı değil. Yine de kapıyı **gönderen çalıştırır**:
Pi'de üç runner aynı makineyi paylaştığı için kuyruk uzayabilir ve CI'ın
cevabını beklemek geri bildirimi yavaşlatır. Dördü de yeşil olmadan PR açılmaz:

```
npm run lint && npm run typecheck && npm test && npm run build
```

Bu komut CI'da da birebir aynı biçimde koşuyor. Pi'ye özgü kısıt
(tek worker, uzun zaman sınırı) `vitest.config.ts` ve `playwright.config.ts`
içinde `process.env.CI`'a bağlı; iş akışından bayrak geçirilmez, yoksa
belgelenen kapı ile CI'ın koştuğu komut sessizce ayrışır.

**CI kırmızısını okurken:** bir iş "test adımı tamamlanmadı, sonraki adımlar hiç
koşmadı, log yüklenmedi" imzasıyla düşerse bu bir test kırmızısı değil — Pi'de
eşzamanlı üç ağır süit birbirini öldürüyor (ölçüm: is-koala/koala#97).

`npm run build` `.env.local` istiyor; `.env.example` kopyalanıp `API_URL`
yerel bir değere çevrilir (dosya Git'e girmez).

## Sır yönetimi

`.env.local` Git'e girmez. `NEXT_PUBLIC_` önekli hiçbir değişkene sır konmaz
— o değerler tarayıcıya gider. Sunucu tarafı sırlar yalnız deploy ortamında.
