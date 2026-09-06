import type { MetadataRoute } from "next";

import { publicEnvironment } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = publicEnvironment();
  if (new URL(siteUrl).hostname === "staging.iskoala.com") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/giris", "/cikis", "/hesap-dogrula", "/sifre-belirle", "/sifre-sifirla", "/eposta-onayla", "/uygulamayi-ac", "/payment/result"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
