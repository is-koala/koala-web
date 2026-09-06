import { countriesRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

/** Sağlayıcı düştüğünde elle seçim yedeği. */
export function GET() {
  return countriesRoute();
}
