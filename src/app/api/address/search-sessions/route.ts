import { startSessionRoute } from "@/server/address/routes";

export const dynamic = "force-dynamic";

/**
 * Adres arama oturumunu açar.
 *
 * Tarayıcı `api.iskoala.com` ile konuşmadığı için (ADR-0011) ağ geçidinin
 * bütün adımları aynı origin'deki bu uçlardan geçer; `src/proxy.ts` durum
 * değiştiren isteklerde origin eşleşmesini zaten doğruluyor.
 */
export function POST() {
  return startSessionRoute();
}
