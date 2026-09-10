import { sitemapErrorResponse, sitemapXmlResponse } from "@/server/seo/http";
import { readSitemapIndex, sitemapIndexXml } from "@/server/seo/sitemap";

/** Index her istekte backend'in güncel immutable manifest version'ından üretilir. */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const index = await readSitemapIndex();
    return sitemapXmlResponse(sitemapIndexXml(index.entries), index.cache);
  } catch (error) {
    return sitemapErrorResponse(error);
  }
}
