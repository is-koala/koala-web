import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";

import { privateHeaderSources, privateResponseHeaders } from "./src/lib/private-routes";
import { imageBudget } from "./src/lib/image-budget";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_ISOLATED_TEST_BUILD === "messaging-safety"
    ? ".next/messaging-safety"
    : ".next",
  typescript: {
    tsconfigPath: process.env.NEXT_ISOLATED_TEST_BUILD === "messaging-safety"
      ? "tsconfig.messaging-safety.json"
      : "tsconfig.json",
  },
  output: "standalone",
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  images: imageBudget,
  experimental: {
    // Kimlik formu dört ayrı 10 MiB fotoğraf taşıyor; ham multipart isteği
    // action doğrulamasına ulaşabilsin diye toplam bütçeye boundary payı kalır.
    serverActions: { bodySizeLimit: "42mb" },
  },
  async redirects() {
    return [
      { source: "/faq", destination: "/sss", statusCode: 301 },
      { source: "/about", destination: "/hakkimizda", statusCode: 301 },
      { source: "/contact", destination: "/iletisim", statusCode: 301 },
      { source: "/privacy", destination: "/gizlilik-politikasi", statusCode: 301 },
      { source: "/profile", destination: "/uygulamayi-ac", statusCode: 301 },
      // Kalıcı: backend kayıt bağlantısını yalnız `/hesap-dogrula` olarak
      // üretiyor (`AuthLinkManager.REGISTRATION_WEB_PATH`) ve `/sifre-belirle`
      // adresine giden hiçbir bağlantı yok. Ayrı bir akış açmak yerine
      // yönlendirme duruyor; silmek eski e-postaları kırardı.
      { source: "/sifre-belirle", destination: "/hesap-dogrula", permanent: true },
      {
        source: "/:path((?!\\.well-known(?:/|$)).*)",
        has: [{ type: "host", value: "www.iskoala.com" }],
        destination: "https://iskoala.com/:path*",
        statusCode: 301,
      },
    ];
  },
  async headers() {
    const privateHeaders = Object.entries(privateResponseHeaders).map(([key, value]) => ({
      key,
      value,
    }));
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "staging.iskoala.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      ...privateHeaderSources.map((source) => ({ source, headers: privateHeaders })),
    ];
  },
};

const withMDX = createMDX({});
export default withSentryConfig(withMDX(nextConfig), {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
