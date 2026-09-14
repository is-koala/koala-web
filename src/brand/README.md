# Marka varlıkları

Tasarımcının 13.09.2026 teslimi (`design/tanitim-sitesi-v2`, is-koala/koala-web#155)
ile gerçek marka geldi. Dosyalar `public/brand/` altında:

| Dosya | Kaynak | Kullanım |
| --- | --- | --- |
| `head.png` | `assets/images/koala_logo_1.png` | Başlıktaki maskot başı (`Wordmark.tsx`) |
| `wordmark-green.png`, `wordmark-white.png` | `assets/brand/lockup-green.png` içindeki "KOALA" yazısı, beyazlık maskesiyle çıkarılıp boyandı | Wordmark; yazı yüzü Folkra lisanslı olduğu için görsel |
| `lockup-green.png` | `assets/brand/lockup-green.png` | Altbilgi |
| `mark-white.png` | `assets/brand/lockup-white.png` | Kampanya bölümü |
| `afis-post.webp` | `assets/brand/afis-post.png` (900px) | Kampanya afişi |
| `map-istanbul.webp` | `assets/images/background_map.png` | Hero harita kartı, telefon ekranı |
| `maskot-1..3.webp` | `assets/images/onboarding-*.png` (800px) | Biz kimiz, adımlar, erken erişim |
| `maskot-calisan.webp`, `maskot-isveren.webp` | `assets/images/koala_worker.png`, `koala_business.png` (600px) | İki taraf |
| `profil-ornek.png` | `assets/images/koala_profile_picture.png` | Telefon ekranı |
| `pins/*.svg` | `assets/map_pins/*.svg` | Kategori pinleri |

Renklerin adlandırılmış tek kaynağı `tokens.ts` ve `globals.css` `:root`.
Marka yeşili `#82C180` yazı için AA'yı geçmez; yazı ve düğme dolgusu
`#3F7A3D` (`--koala-green-ink`). `contrast.test.ts` bunu tutar.
