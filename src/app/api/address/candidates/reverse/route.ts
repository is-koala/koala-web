import { reverseRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

/** Harita pininden adres önerisi; harita seçici (#28) bu ucu kullanacak. */
export function POST(request: Request) {
  return reverseRoute(request);
}
