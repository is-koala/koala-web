import { suggestionsRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return suggestionsRoute(request, (await params).sessionId);
}
