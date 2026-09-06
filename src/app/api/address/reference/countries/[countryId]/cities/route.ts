import { citiesRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ countryId: string }> },
) {
  return citiesRoute((await params).countryId);
}
