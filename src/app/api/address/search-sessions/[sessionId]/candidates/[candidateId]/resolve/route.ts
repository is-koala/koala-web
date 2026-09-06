import { resolveRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

/** Adayı çözümler; dönen `candidateToken` tek kullanımlık kanıttır. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; candidateId: string }> },
) {
  const { sessionId, candidateId } = await params;
  return resolveRoute(sessionId, candidateId);
}
