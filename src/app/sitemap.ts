import type { MetadataRoute } from "next";

import { legalCatalog } from "@/content/legal/catalog";
import { publicEnvironment } from "@/lib/env";

const publicPaths = [
  "", "/is-arayanlar", "/isverenler", "/nasil-calisir", "/hakkimizda", "/iletisim", "/sss",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = publicEnvironment();
  const legalPaths = Object.entries(legalCatalog).flatMap(([slug, document]) => [
    `/${slug}`,
    `/${slug}/v/${document.version}`,
  ]);
  return [...publicPaths, ...legalPaths].map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: path.includes("/v/") ? "never" : "monthly",
  }));
}
