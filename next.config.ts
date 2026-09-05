import type { NextConfig } from "next";
import createMDX from "@next/mdx";

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
      { source: "/sifre-belirle", destination: "/hesap-dogrula", permanent: true },
      {
        source: "/:path*",
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
      { source: "/hesap-dogrula", headers: privateHeaders },
      { source: "/sifre-belirle", headers: privateHeaders },
      { source: "/sifre-sifirla", headers: privateHeaders },
      { source: "/eposta-onayla", headers: privateHeaders },
      { source: "/uygulamayi-ac", headers: privateHeaders },
      { source: "/payment/result", headers: privateHeaders },
    ];
  },
};

const withMDX = createMDX({});
export default withMDX(nextConfig);
