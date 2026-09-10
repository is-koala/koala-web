import {
  sitemapErrorResponse,
  sitemapStatusResponse,
  sitemapXmlResponse,
} from "@/server/seo/http";
import {
  parseSitemapShardTarget,
  readSitemapShard,
  sitemapEntriesXml,
} from "@/server/seo/sitemap";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ file?: readonly string[] }> };

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const { file } = await params;
  const target = parseSitemapShardTarget(file);
  if (target === null) return sitemapStatusResponse(400);

  try {
    const entries = await readSitemapShard(target);
    return sitemapXmlResponse(
      sitemapEntriesXml(entries),
      target.kind === "jobs" ? "no-store" : undefined,
    );
  } catch (error) {
    return sitemapErrorResponse(error);
  }
}
