import type { MetadataRoute } from "next";

import { publicEnvironment } from "@/lib/env";
import { privateDisallowRules } from "@/lib/private-routes";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = publicEnvironment();
  if (new URL(siteUrl).hostname === "staging.iskoala.com") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...privateDisallowRules],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
