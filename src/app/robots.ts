import type { MetadataRoute } from "next";

import { publicEnvironment } from "@/lib/env";
import { privateRoutes } from "@/lib/private-routes";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = publicEnvironment();
  if (new URL(siteUrl).hostname === "staging.iskoala.com") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...privateRoutes],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
