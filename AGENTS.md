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
  Oturum açan üç çağrı (giriş, kayıt tamamlama, yenileme) ayrıca
  `X-Koala-OS` (isteğin `User-Agent`'ından) ve `X-Koala-App-Version`
  (`package.json` sürümü, build sabiti) taşır; backend cihaz adını bunlardan
  kurar (`src/server/session/device-hints.ts`, is-koala/koala-web#188).
  `X-Koala-Device-Model` web'de hiç gönderilmez — tarayıcı donanımı söylemez.
- Tarayıcının doğrudan açtığı STOMP bağlantısı HTTP BFF sınırının tek
  istisnasıdır. Ana oturum tokenını JavaScript'e açma; kısa ömürlü STOMP
  kimliği backend'de hazır olana kadar web mesajlaşmasını bağlama.
- Yanıt zarfı: `{ success, data, message, errorCode, httpStatus, timeStamp }`.
  Hata yönlendirmesi **`errorCode`** ile yapılır, mesaj metniyle asla.
- Adres seçimi backend'in sağlayıcıdan bağımsız ağ geçidi üzerinden yapılır;
  Google anahtarı istemciye **hiç** girmez. Harita için ayrı, HTTP referrer
  kısıtlı bir Maps JavaScript anahtarı gerekir.
- Web'in backend enum'larından kopyaladığı listeler (bugün bildirim
  kategorisi/kanalı) `tests/contracts/*.openapi.json` parçasına sözleşme
  testiyle bağlı. Parça canlı `/v3/api-docs`'a karşı `npm run test:contract`
  ile denetlenir: sürümden önce ve backend bir enum'u değiştirdiğinde koştur;
  kırmızıysa parçayı ve web listesini birlikte güncelle (is-koala/koala-web#198).
- Bir alanı, o alanın **sahibi** uçtan oku: şirket adresi
  `GET /companies/{id}`'den, ilanın `company` özetinden değil. İç içe özet
  DTO'lar (`JobCompanyDto` gibi) sonradan alan düşürebiliyor ve `?.` zinciri
  bunu sessizce "yok" diye okur; ödeme sayfası böyle her şirket ilanında
  "adres eksik" dedi (is-koala/koala-web#171, is-koala/koala-backend#159).

## Yapı

```
src/app/
  (marketing)/     tanıtım sayfaları — statik üretilir, SEO önemli
  (legal)/         yasal metinler — mobil uygulama da bunlara link verir
  (account)/       e-posta karşılama akışları — sunucu tarafı
  (uygulama)/      oturumlu kabuklar — /isveren ve /panel
```

Rota adları Türkçe ve kalıcıdır: `/hesap-dogrula`, `/sifre-belirle`,
`/sifre-sifirla`, `/eposta-onayla`, `/uygulamayi-ac`, `/davet/{invitationId}`,
`/bildirim-tercihleri/cikis`. Bunlar e-postalara gömülecek; **değiştirmek eski
e-postaları kırar.** Sonuncusu ticari e-postanın tek tıklık çıkışı
(is-koala/koala-web#54): sayfa statik ve açılışta hiçbir şeyi değiştirmez,
tercih yalnız kullanıcının onayıyla `POST /api/notification-preferences/unsubscribe`
üzerinden kapanır; token sunucu render'ına, DOM'a ve loglara girmez. Sayfanın
"tercihlerimi yönet" bağlantısı `/hesap/bildirimler`'e iner: rol bilmeyen bu
adres oturumlu kullanıcıyı kendi kabuğunun `hesap#bildirim-tercihleri`
bölümüne, oturumsuzu `?next=` ile girişe yönlendirir.
`/kimlik-dogrula` e-postada değil: kimlik kapısının aktarım adresi, yeniden
adlandırmak şeritleri ve başvuru çözümünü kırar.

`(uygulama)` altındaki iki kabuk oturum ister ve arama motorlarına kapalıdır:

- Kabuk layout'u `enterShell()` çağırır — önce `requireSessionForCurrentPath()`
  kapısı, sonra `React.cache()` ile paylaşılan `GET /users/me`. Kabuğun
  **altındaki her sayfa da** aynı çağrıyı yapar; kapı ucuz, profil paylaşılıyor
  ve sayfa kapısını layout'tan miras almıyor.
- Menü ve "henüz açılmadı" ekranları tek bir kayıttan çizilir:
  `src/lib/app-routes.ts`. Yeni bir bölüm önce oraya yazılır.
- Kabuk sayfaları görünüşü `src/components/ui` setinden alır (is-koala/koala-web#156):
  `PagePanel`/`PageHeader` sayfa başlığı, `Card`, `StatusBadge` (tonlar tasarım
  sisteminin durum token'larından; etiket metni kendi modülünde kalır),
  `LinkTabs` (adres çubuğuna yazan süzgeç/sıralama), `EmptyStateCard` (maskot),
  `ListRow`/`FactList`, `StatCard`, `Field`. Kabuk kromu
  `src/components/app-shell.css`'te, token'lar `globals.css`'te; yeni kural
  ham renk ya da piksel köşe yazmaz, token okur. Hepsi durumsuz sunum
  bileşeni: `use client` taşımaz, durum okumaz, çerez açmaz; sunucu sayfaları
  da istemci parçaları da aynı dosyalardan alır (mesaj dizisi
  `list-row`/`status-badge`, üst bar `icon`). Kabuk kromunun tek istemci
  parçası menünün `aria-current` bağlantısı (`app-nav-link.tsx`).
- Kabuk kökleri `src/lib/private-routes.ts` içindeki `privateRouteTrees`
  listesinde durur. `/isveren` tanıtım sayfası `/isverenler`'in **öneki**:
  robots.txt eşleşmesi önek temelli olduğu için ağaç `/isveren$` ve `/isveren/`
  olarak iki satıra açılır. Liste kabuklardan **ibaret değil**: kabuk altında
  olmayan ama adresi bir sır taşıyan rotalar da oraya girer — `/davet` bir
  davet kimliği taşıyor ve `GET /contact-invitations/{id}` sahiplik denetimi
  yapmadığı için o kimliği bilen herkes daveti okuyabiliyor.
  `next.config.ts` bu listeden `X-Robots-Tag`, `Referrer-Policy: strict-origin`
  ve `Cache-Control: no-store` basıyor; üçüncüsü yalnız `next start` ile
  görülür, `next dev` her dinamik yanıtın üzerine kendi
  `no-cache, must-revalidate` başlığını yazıyor, bu yüzden Playwright
  koşuları ona bakamaz. Politika **`no-referrer` değil**: o politikada
  tarayıcı düz form POST'una `Origin: null` yazıyor ve server action'lı her
  form JavaScript'siz ve hidrasyondan önce hem vekilde (403) hem Next'in
  action CSRF denetiminde (500) reddediliyordu (is-koala/koala-web#199,
  `tests/e2e/no-js-forms.spec.ts`). `strict-origin` aynı origin POST'una
  gerçek origin'i yazdırır, `Referer`'a yalnız origin girer — yol ve sorgu
  (token, davet kimliği) hiçbir isteğe girmez. CSRF kapısını `null`'u kabul
  edecek biçimde gevşetme. Aynı politika `next.config.ts`'te **site geneli**
  de basılıyor: belge politikası yalnız sert yüklemede yerleşiyor ve tanıtım
  sayfasından istemci tarafı gezinmeyle gizli bir rotaya geçen belge aksi
  hâlde varsayılanda kalırdı. Tek istisna abonelikten çıkma sayfası
  (`/bildirim-tercihleri/cikis`): `<meta name="referrer" content="no-referrer">`
  ile sıkılaştırıyor; düz form POST'u olmadığı (onay `cors` kipinde bir
  `fetch`) için `Origin: null` sorunu orada doğmuyor.
- `loading.tsx` bir segmenti Suspense sınırına sokar ve bunun **iki** ayrı yan
  etkisi var. İkisi de ekranda görünmez; JavaScript açık her tarayıcıda sayfa
  doğru çalışır. `src/app/route-shape.test.ts` ikisini de zorluyor.

  1. **HTTP durumu 200'de kilitlenir.** Sayfa askıya girer girmez kabuk erken
     akıtılır ve `notFound()` artık 404 döndüremez. Bu yüzden `loading.tsx`,
     yanındaki `page.tsx` `notFound()` çağırıyorsa konulamaz — kabuk kökünde
     de, bölümün kendi klasöründe de. Kural yalnız kabuk köküyle sınırlı
     değil: `notFound()` bir `await`'ten **sonra** çağrılıyorsa bölümün kendi
     `loading.tsx`'i de aynı sonucu verir.
  2. **İçerik ilk HTML'e `<div hidden>` içinde girer.** Sayfanın asıl gövdesi
     belgeye `<div hidden id="S:1">…</div>` olarak yazılır ve onu yerine
     taşıyan şey satır içi bir script'tir. JavaScript kapalı ya da
     çalışmamışsa taşıma hiç olmaz: ziyaretçi sonsuza kadar iskeleti görür.
     Bu yüzden `loading.tsx`, içeriğinin script'siz görünmesi gereken hiçbir
     tanıtım sayfasının yanına konulamaz — `(marketing)` "statik üretilir, SEO
     önemli" diyor ve orada iskelet, indekslenen tek şey olur. Kusur
     is-koala/koala-web#93'te ilan listesinde, #94'te ilan ayrıntısında
     ölçüldü; ikisinde de kaynak koda değil, `next build && next start`
     sonrası `curl` ile **üretilen HTML'e** bakılarak bulundu.

  Her iki durumda da yükleniyor durumu başka yere taşınır: karar verildikten
  **sonra** açılan bir iç `Suspense` sınırına, ya da gezinme bağlantısının
  içine (`src/components/link-pending.tsx`, `useLinkStatus`).
- Yetki kapıları tek katmanda: sözlük `src/lib/gates.ts`, karar
  `src/server/session/gates.ts`, metin `src/lib/gate-notices.ts`
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
  bunu yapıyor —   `/isveren/ilan/yeni`, `/isveren/sirket/yeni` ve
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
- **Kimlik doğrulaması web'de çiple tamamlanamaz; belge ile tamamlanır.**
  Backend `sod` + `dg1` ister; tarayıcıda Web NFC / WebUSB o protokolü
  bitirmiyor. Elle beş alan damgalamaz. `identityVerification` kapısı
  `/kimlik-dogrula`'ya düşer; ekran TCKK ön/arka fotoğrafını
  `POST /users/me/identity-documents` ile kuyruğa alır. BFF
  `POST /api/users/me/identity-verification` uçları 501 +
  `IDENTITY_CHIP_PA_NOT_AVAILABLE_ON_WEB` döner, gövdeyi okumaz, backend'e
  çıkmaz.
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
  ayrı bir karar ve ayrı dosyada — `postLoginDestination`
  (`src/server/session/login-redirect.ts`) kullanıcıyı kapıya takıldığı
  sayfaya geri bırakıyor; dönülecek bir sayfa yoksa `isEmployer`'a göre
  kabuğuna (`/panel` ya da `/isveren`, is-koala/koala-web#154) gidiyor ve rol
  okunamadıysa `/` kalıyor. Bu bir kapı değil, varsayılan: öbür kabuk
  adresinden hâlâ açılıyor. Tanıtım başlığı aynı bilgiyi `/api/session`'dan
  okuyup "Panelim" ya da "İşveren panelim" yazıyor; "Uygulamayı aç" ikincil
  bağlantı.
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

Hata kataloğu **rota bazında bölünmüş** (is-koala/koala-web#177):
`src/lib/public-errors.ts` yalnız oturum, giriş, kayıt ve başvuru kodlarını
taşır; `(marketing)` ile `(account)` giriş/kayıt/parola rotaları — sunucu
sayfaları dahil — yalnız onu okur (`PublicErrorState` —
`src/components/public-states.tsx`, `PublicFormAlert` —
`src/components/public-form-alert.tsx`; 244 kodun aile haritası
`backend-error-codes.ts` bu yüzeyde statik içe aktarılmaz, katalogda olmayan
kodda `loadBackendErrorFamilies` ile tembel gelir, is-koala/koala-web#184;
kök `error.tsx` kod bilmediği için
doğrudan `unexpectedErrorPresentation` çizer; yükleniyor/boş durumları
katalogsuz `src/components/placeholder-states.tsx`'te). Kabuk ve `(account)`
altındaki `davet`, `kimlik-dogrula`, `payment` rotaları `src/lib/errors.ts`'i
okur (`ErrorState`, `FormAlert` — `src/components/states.tsx`); o dosya
küçük kataloğu alan modülleriyle birleştirir: `src/payments/errors.ts`,
`src/lib/company-errors.ts`, `src/messaging/errors.ts`,
`src/assignments/errors.ts`, `src/jobs/errors.ts`, `src/identity/errors.ts`,
`src/address/errors.ts`, `src/lib/gallery-errors.ts`, `src/lib/account-errors.ts`.
Yeni kabuk cümlesi ait olduğu alan dosyasına yazılır (alanı yoksa yeni bir
`*-errors.ts`); herkese açık bir sayfada görünecek cümle `public-errors.ts`'e
gider ve önce ilan ayrıntısının betik bütçesi ölçülür
(`docs/performance-accessibility-budget.md`). İstisna rotaya özgü sonuç
metni: ham `errorCode` ile değil, BFF'nin döndürdüğü bir sonuçla seçilen ve
yalnız tek rotada görülen cümle o rotanın `src/content/*` modülünde durur
(`ErrorCatalog` olarak değil) — `public-errors.ts` ilan ayrıntısının ilk
yüküne giriyor ve oraya yazılan her cümle o sayfanın betik bütçesinden yer.
Örnek: çıkış bağlantısının "süresi dolmuş/geçersiz" kartları
(`src/content/unsubscribe.ts`).
`src/lib/error-catalog-boundary.test.ts` sınırı iki yönde tutar: herkese açık
rotaların import grafiği `ErrorCatalog` bildiren hiçbir modüle ulaşmaz
(`public-errors.ts` hariç), kabuk küçük kataloğu doğrudan okumaz.

Kapalı düğmeler iki ayrı durumu anlatır. Yalnız uçuşta olan bir istek yüzünden
geçici kapanan `.button` varsayılan `cursor: wait` davranışını kullanır. Ürün
veya durum önkoşulu yüzünden beklemekle açılmayacak bir düğme hem kapalılık
gerekçesini yanında gösterir hem de `data-disabled-kind="permanent"` taşır;
bu işaret imleci `not-allowed` yapar. `aria-disabled` bu görsel sınıflandırma
için kullanılmaz: gerçek düğmede native `disabled` erişilebilirlik ve etkileşim
sınırını zaten kurar.

### Önbelleklenen sayfada hata kartı çizme

`revalidate` taşıyan bir sayfada (bugün yalnız ilan ayrıntısı) hata durumu
sayfanın **içinde** çizilemez. Yakalanıp bir karta dönüştürülen backend hatası
yanıtı 200 yapıyor ve `s-maxage` onu pencere boyunca kilitliyor: backend
iyileşse bile ziyaretçi hata kartını almaya devam ediyor ve istek backend'e
hiç gitmiyor. Ölçüldü (is-koala/koala-web#98): 503'ten sonra backend
düzeltildi, üç istek de önbellekten hata kartı aldı, backend'e sıfır istek
gitti.

Ayrım **kalıcı yokluk ile geçici arıza** arasında:

- **404 kalıcı** — `notFound()`; cevap pencere boyunca aynı kalacağı için
  önbelleğe girmesi doğru.
- **Öbür her hata geçici** — yeniden atılır. Next'in ISR rehberi bunu
  söylüyor (*"throw an error instead of returning so that the cache is not
  updated"*): atılan render önbelleğe yazılmıyor, durum kodu 500 oluyor ve
  bir sonraki istek backend'e yeniden gidiyor.

**Ekran durumu bu rotada bir ekran değil, ve bunu bilerek yazıyoruz.**
Önbellekte olmayan bir ilan arıza sırasında Next'in yerleşik 500 gövdesini
alıyor: 21 baytlık, çevrilmemiş "Internal Server Error". Bölüme `error.tsx`
kondu ve **çalışmadı** — ISR üretimi sırasında atılan hata için o sınır hiç
render edilmiyor, `global-error.tsx` de öyle. `await connection()` ile hata
dalında dinamik render'a düşmek de denendi; `revalidate` taşıyan rotada Next
onu `DYNAMIC_SERVER_USAGE` ile reddediyor. Üçü de `next build` + standalone
`server.js` + `curl` ile ölçüldü, kaynak koda bakılarak değil.

Takas bilinçli: karşılığında arıza önbelleğe hiç girmiyor, iyileşme sonraki
istekte görünüyor, ve **zaten önbellekte olan ilan arıza boyunca kendi doğru
sayfasını sunmaya devam ediyor** — eski davranışta o sayfa da beş dakikalığına
hata kartına dönüşüyordu. Çevrilmiş bir 500 gövdesi isteniyorsa yeri bu rota
değil, önündeki ters vekil.

## Commit ve PR

Değişiklikler ayrı feature branch'te küçük Conventional Commit'lerle
gönderilir ve PR açılır. Doğrudan `main` dalına push edilmez; başlık İngilizce imperative,
gövde `Refs #NN` taşır ve `git add .` kullanılmaz.

**Kalite kapısı GitHub Actions'tadır.** `.github/workflows/ci.yml` her
`main` PR'ında, `main` push'unda ve `workflow_dispatch` ile GitHub'ın kendi
`ubuntu-latest` runner'ında koşar; self-hosted runner yok. Aynı PR'a yeni
push eski koşuyu iptal eder. Başarısız koşu Playwright/Lighthouse raporlarını
7 günlük artifact olarak bırakır. Dördü de yeşil olmadan PR birleşmez:

```
npm run lint && npm run typecheck && npm test && npm run build
```

Build'den sonra Playwright E2E (`npm run test:e2e`) ve Lighthouse bütçesi
(`npm run test:performance`) de yeşil olur; ikincisinin sayıları
`docs/performance-accessibility-budget.md` içindedir. Lighthouse kapısını
betik baytı, CLS, LCP ve TBT kırar; performans **puanı** yalnız uyarıdır,
çünkü GitHub runner'ında aynı kodla 0,55–0,78 arası oynuyor. Puanı yeniden
`error` yapma; gerileme varsa onu oluşturan ölçüyü sıkılaştır.

`CI` ortamına özgü kısıt (tek worker, uzun zaman sınırı) `vitest.config.ts`
ve `playwright.config.ts` içinde `process.env.CI`'a bağlı; iş akışından
bayrak geçirilmez, yoksa belgelenen kapı ile iş akışının
koştuğu komut sessizce ayrışır.

`npm run build` `.env.local` istiyor; `.env.example` kopyalanıp `API_URL`
yerel bir değere çevrilir (dosya Git'e girmez).

## Sır yönetimi

`.env.local` Git'e girmez. `NEXT_PUBLIC_` önekli hiçbir değişkene sır konmaz
— o değerler tarayıcıya gider. Sunucu tarafı sırlar yalnız deploy ortamında.

`NEXT_PUBLIC_` değerleri `next build` sırasında donar; çalışan container'a
sonradan eklenen runtime değişkeni tarayıcı bundle'ını değiştirmez. Bu yüzden
istemci veya build girişlerinde okunan her public ad, `Dockerfile` builder
aşamasında `ARG` ve aynı adlı `ENV NAME=$NAME` olarak `npm run build` öncesinde
bulunur. Next yalnız `process.env.NAME` biçimindeki statik erişimi inline eder;
`process.env[name]` etmez. Bu yüzden gönderilen kaynakta `process.env` aliası,
destructuring veya computed erişim kullanılmaz. `requiredEnvironmentValue` ile
public ad okuyan çağrı ikinci argümanda doğrudan
`process.env.NEXT_PUBLIC_...` değerini geçirir. `src/public-env-baked.test.ts`
bu sözleşmeyi TypeScript AST ve derlenmiş MDX modülleri üzerinden hem `src/`
hem kök Next girişleri için tutar; yeni ad eklerken testi gevşetme.
