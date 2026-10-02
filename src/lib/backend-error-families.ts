import type { BackendErrorFamily } from "./backend-error-codes";

export type BackendErrorFamilies = Readonly<Record<string, BackendErrorFamily>>;

let families: Promise<BackendErrorFamilies> | null = null;

/**
 * 244 backend kodunun aile haritasını (`backend-error-codes.ts`, ≈2,3 KB)
 * tembel getirir (is-koala/koala-web#184).
 *
 * Herkese açık yüzeyde harita yalnız küçük katalogda olmayan bir kod
 * geldiğinde okunuyor; statik içe aktarıldığında ilan ayrıntısının başvuru
 * formu parçasıyla her ziyaretçiye iniyordu. Kabuk (`errors.ts`) haritayı
 * statik okumaya devam eder; orada paket bütçesi yok.
 *
 * Parça inmezse (yavaş ya da kopan ağ) söz reddedilmez, boş haritayla
 * çözülür: kart çökmek yerine durum koduna göre nötr metne düşer ve sonraki
 * çağrı yeniden dener.
 */
export function loadBackendErrorFamilies(): Promise<BackendErrorFamilies> {
  if (families) return families;

  const loading: Promise<BackendErrorFamilies> = import("./backend-error-codes").then(
    (module) => {
      // React'in söz protokolü: `use()` durumu `fulfilled` olan sözü askıya
      // girmeden okur. Sunucu çizimi ve sonraki kartlar bu yüzden beklemez.
      Object.assign(loading, { status: "fulfilled", value: module.backendErrorFamilies });
      return module.backendErrorFamilies;
    },
    (): BackendErrorFamilies => {
      families = null;
      return {};
    },
  );
  families = loading;
  return loading;
}

// Sunucuda (RSC ve SSR) harita modül değerlendirilirken hazırlanır: sunucu
// sayfalarının hata kartı (`hesap-dogrula`, `is-ilanlari`) ilk çizimde
// askıya girmesin ve JavaScript'siz ziyaretçi kartı akış sonrasında saklı
// bir parça olarak değil, doğrudan HTML'de alsın. İstemci paketinde
// `typeof window` sabitlenir ve bu dal derlemeden düşer.
if (typeof window === "undefined") void loadBackendErrorFamilies();
