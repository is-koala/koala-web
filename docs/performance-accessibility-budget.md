# Performans ve erişilebilirlik bütçesi

Bu bütçe, mobil veri kullanan orta/alt segment Android cihazları temsil eden tekrarlanabilir
bir laboratuvar regresyon kapısıdır. Ana sayfa, ilan listesi ve sabit test ilanı ayrıntısı her CI
çalışmasında Lighthouse ile; ana sayfa, ilan listesi/ayrıntısı, giriş ve kayıt ise axe ile ölçülür.

## Bütçeler

| Ölçüm | Ürün hedefi | CI regresyon sınırı | 2026-09-10 baz çizgisi |
| --- | ---: | ---: | ---: |
| İlk yük JavaScript aktarımı | ≤ 250 KiB (256.000 bayt) | ≤ 256.000 bayt | 233.340–244.567 bayt |
| LCP | ≤ 2.500 ms (p75 alan) | ≤ 12.000 ms (laboratuvar) | 6.613–8.118 ms |
| INP | ≤ 200 ms (p75 alan) | Doğrudan laboratuvar kapısı yok | Alan verisi henüz yok |
| TBT (INP laboratuvar vekili) | < 200 ms | ≤ 300 ms | 29–64 ms |
| CLS | ≤ 0,1 | ≤ 0,1 | 0 |
| Lighthouse performans puanı | ≥ 0,90 | ≥ 0,70 | 0,75–0,77 |

2026-09-14 (is-koala/koala-web#156, kabuk yeniden tasarımı) ölçümü: betik aktarımı ana sayfa
247.648, ilan listesi 249.447, ilan ayrıntısı **255.559** bayt — sınıra 441 bayt kaldı. Aynı
işte `next/image`'ın `EmptyState` üzerinden istemci grafiğine girmesi ayrıntı sayfasını 263.638
bayta çıkarmıştı; boş durum maskotu bu yüzden düz `<img>` ve önceden küçültülmüş dosya
(`src/components/ui/mascot.tsx`). İstemci bileşenlerinden okunan ortak modüllere (`states.tsx`,
`form-controls.tsx`) yeni bağımlılık eklerken bu sayıyı yeniden ölç.

2026-09-14 (is-koala/koala-web#166, işveren ayrıntı yüzeyleri) ölçümü: ana sayfa 247.761,
ilan listesi 249.659, ilan ayrıntısı **255.672** bayt — sınıra 328 bayt kaldı. Bu işte ilan
ayrıntısına yayın tarihi ve işveren güven kartı yalnız sunucu bileşeni olarak girdi; 113 baytlık
artış istemci kodundan değil, sayfanın istemci referans yükünden geliyor. İlan ayrıntısına yeni
istemci bileşeni **sığmıyor**; bir sonraki istemci ihtiyacı önce bütçe düşürmeyi gerektirir.

2026-09-14 (is-koala/koala-web#172, şirket adresi düzenleme; #175 üzerinde) ölçümü: ana sayfa
247.833, ilan listesi 249.724, ilan ayrıntısı **255.735** bayt — sınıra 265 bayt kaldı. İlan
ayrıntısına hiç istemci kodu girmedi; artışın kaynağı `src/lib/errors.ts`. O dosya ilan
sayfasının istemci paketinde (`ErrorState` → `errorPresentation`) ve **her kapı metni, her hata
cümlesi ilan sayfasına gider**: `errors.ts`'e `@/lib/company` içe aktarması eklemek sayfayı
256.983 bayta çıkarıp kapıyı kırdı (983 bayt aşım), `companyBillingAddress` metni kısaltılıp
web'e özgü bir hata kodu geri alınınca 255.735'e indi. `errors.ts`'e yeni cümle ya da içe
aktarma eklerken önce bunu ölç; ilan ayrıntısına sığan pay artık bir uzun cümle kadar.

2026-09-14 (is-koala/koala-web#179, 0.9.25 istemci: sunucudan değerlendirme durumu, işçide
komisyon gizli, hakediş ayrıntısı) ölçümü: ana sayfa 247.832, ilan listesi 249.723, ilan
ayrıntısı **255.734** bayt — sınıra 266 bayt kaldı. Yeni metinlerin tamamı çalışan/işveren
kabuğuna özel modüllerde (`payments/payouts.ts`, `assignments/review.ts`, kabuk bileşenleri);
`errors.ts`'e dokunulmadı, tek baytlık fark chunk adlarından.

Ürün hedefleri iyi Core Web Vitals deneyimini tanımlar; mevcut baz çizgisinin ilk PR'da kapıyı
kırmaması için CI sınırları ayrı tutulur. 3G laboratuvar LCP'si 6,6–8,1 saniye aralığında ölçüldü;
Raspberry Pi koşucunun daha düşük `benchmarkIndex` değeri için CI tavanı 12 saniyedir. Her
iyileştirmeden sonra regresyon sınırları aşağı çekilir; ürün hedefleri gevşetilmez. Lighthouse ilk yük navigasyonunda gerçek INP üretmediği için INP,
gerçek kullanıcı izlemesinde 28 günlük pencerenin p75 değeriyle ölçülmelidir. CI'da TBT yalnızca
erken bir regresyon sinyalidir ve INP'nin yerine geçtiği varsayılmaz.

## Ölçüm profili ve kapı davranışı

`lighthouserc.cjs`, Lighthouse'un `mobileRegular3G` profilini açıkça sabitler: 300 ms RTT,
700 Kbit/sn aktarım, 4× CPU yavaşlatma ve 412×823 / 1,75 DPR mobil ekran. Bu profil,
Lighthouse kaynak kodunda Chrome UX Report'un 3G tanımına yaklaşık olarak hizalanır.

CI maliyetini Raspberry Pi koşucuda sınırlamak için rota başına iki ölçüm alınır. `optimistic`
toplama, tek bir gürültülü koşunun PR'ı kırmasını engeller; bütçe ihlalinin iki koşuda da görünmesi
kapıyı kırar. Kaydedilen raporlar `.lighthouseci/reports` altında yerel artefakt olarak kalır.

Yerel CI eşdeğeri:

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:performance
npm run test:accessibility
```

Tam kalite kapısında `npm run lint`, `npm run typecheck` ve `npm test` de çalıştırılır.

## Erişilebilirlik kabulü

- axe, beş kamu rotasında WCAG 2 A/AA/2.1 A/AA/2.2 AA etiketlerini tarar; `serious` veya
  `critical` etki düzeyi CI'ı kırar.
- Klavye testleri görünür atlama bağlantısını, ilan filtresini, ilan ayrıntısındaki başvuruyu,
  giriş ve kayıt gönderimini fare olmadan tamamlar.
- Temel metin kontrastı en az 4,5:1, odak göstergeleri görünür, sayfa dili `tr` ve formlar
  erişilebilir adlara sahiptir.

## Bilinen artıklar ve korunan kapsam

İlk ziyaret çerez onayı istemci hidrasyonundan sonra çizildiği için mevcut laboratuvar LCP'si iyi
ürün hedefinin üzerindedir. Bu belge gerilemeyi durdurur; onay durumunu sunucuda güvenle okumadan
banner'ı daha erken çizdirmek geri dönen kullanıcılarda yanlış bir flaşa yol açacağından ayrı bir
iyileştirme işi olarak kalır.

Issue #28 kapsamındaki Maps JavaScript yükleme davranışı ve issue #35 kapsamındaki ilan galerisi/
görsel dönüşümü bu değişiklikte düzenlenmedi. Kapı, haritanın ilan listesi/ayrıntısı global
bundle'ına girmemesini ve `next/image` format/boyut sınırlarını tutar. Bu özellikler birleştiğinde
yalnız ihtiyaç duyan rotada etkileşimle yükleme, depolama kökeni `remotePatterns` ve yeni ayrıntı
fikstürü aynı bütçe kapısına eklenmelidir.

## Dayanaklar

- [Largest Contentful Paint: 2,5 saniye ve p75](https://web.dev/articles/lcp)
- [Interaction to Next Paint: 200 ms ve p75](https://web.dev/articles/optimize-inp)
- [Total Blocking Time: 200 ms ve INP ile ilişkisi](https://web.dev/articles/tbt)
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/)
- [Lighthouse CI yapılandırması ve bütçe ifadeleri](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)
- [axe-core Playwright kullanımı](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
