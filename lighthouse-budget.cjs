const fixtureJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const optimistic = { aggregationMethod: "optimistic" };
const median = { aggregationMethod: "median" };

/**
 * Lighthouse CI bütçesi. Playwright Chromium yolu `lighthouserc.cjs`
 * içinde eklenir; bu dosya Vitest'in asıl Playwright paketini yüklemeden
 * sayıları pinlemesi için ayrı duruyor.
 */
module.exports = {
  // Hesap girişleri (is-koala/koala-web#197): `/giris` 256 KB sınırını
  // aşıyordu ve listede olmadığı için hiçbir kapı görmüyordu.
  urls: ["/", "/is-ilanlari", `/is-ilanlari/${fixtureJobId}`, "/giris", "/kayit", "/sifre-unuttum"],
  fixtureJobId,
  numberOfRuns: 3,
  settings: {
    formFactor: "mobile",
    throttlingMethod: "simulate",
    throttling: {
      rttMs: 300,
      throughputKbps: 700,
      requestLatencyMs: 1_125,
      downloadThroughputKbps: 630,
      uploadThroughputKbps: 630,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    },
    chromeFlags: "--headless=new --no-sandbox",
  },
  // Kapıyı deterministik ve ağ ağırlıklı ölçüler tutar. Performans puanı
  // ubuntu-latest'te aynı kodla 0,55–0,78 arası oynuyor: ağırlığının yarısı
  // CPU'ya bağlı TBT ile çift kipli Speed Index'te (aynı rotada 1,8 ↔ 6,3 sn)
  // ve `/` medyanı 5 ölçümde bile 0,66–0,69 çıktı. Puan uyarı olarak raporda
  // kalır; kırmızıyı onu oluşturan ölçüler verir (is-koala/koala-web#209).
  assertions: {
    "categories:performance": ["warn", { minScore: 0.7, ...median }],
    "largest-contentful-paint": ["error", { maxNumericValue: 12_000, ...median }],
    // TBT ana iş parçacığı süresi; runner gürültüsü tek ölçümü 600 ms'ye
    // çıkarabiliyor. Gerçek bir regresyon her ölçümde görünür, o yüzden en
    // iyi ölçüm de sınırı aşınca kırar.
    "total-blocking-time": ["error", { maxNumericValue: 300, ...optimistic }],
    "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, ...optimistic }],
    "resource-summary:script:size": ["error", { maxNumericValue: 256_000, ...optimistic }],
  },
};
