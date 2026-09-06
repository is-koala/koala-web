import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";

import { privateRoutes } from "./src/lib/private-routes";

const nextConfig: NextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
    const privateHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "staging.iskoala.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      ...privateRoutes.map((source) => ({ source, headers: privateHeaders })),
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
