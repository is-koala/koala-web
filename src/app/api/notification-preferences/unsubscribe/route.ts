import { unsubscribeRoute } from "@/server/notifications/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Ticari e-postadaki çıkış bağlantısının BFF ucu (is-koala/koala-web#54).
 *
 * Tarayıcı `api.iskoala.com` ile konuşmadığı için (ADR-0011) onaylanan
 * çıkış buradan geçer; `src/proxy.ts` durum değiştiren isteklerde origin
 * eşleşmesini zaten doğruluyor. Mantık `src/server/notifications` altında.
 */
export function POST(request: Request) {
  return unsubscribeRoute(request);
}
