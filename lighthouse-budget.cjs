const fixtureJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const optimistic = { aggregationMethod: "optimistic" };

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
  numberOfRuns: 2,
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
  assertions: {
    "categories:performance": ["error", { minScore: 0.7, ...optimistic }],
    "largest-contentful-paint": ["error", { maxNumericValue: 12_000, ...optimistic }],
    "total-blocking-time": ["error", { maxNumericValue: 300, ...optimistic }],
    "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, ...optimistic }],
    "resource-summary:script:size": ["error", { maxNumericValue: 256_000, ...optimistic }],
  },
};
