import { districtsRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ cityId: string }> }) {
  return districtsRoute((await params).cityId);
}
