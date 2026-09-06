import "server-only";

import { writeDeviceIdCookie, writeSessionCookies } from "@/server/session/cookies";
import type { TokenPair } from "@/server/session/refresh";

/**
 * Backend'in döndürdüğü token çiftini tarayıcıdaki oturuma çevirir.
 *
 * İki uç oturum açıyor — `POST /auth/login` ve `POST /auth/complete-registration`
 * — ve ikisinde de cihaz kimliği çerezi oturumun bağlandığı kimlikle
 * tazelenmeli: vekilin istek başına ürettiği kimlik yarışında geç düşen bir
 * çerez, oturumu bağlandığı cihazdan koparır ve backend onu geri dönüşsüz
 * pasifleştirir (`AUTH_SESSION_NOT_MATCHING_CURRENT_DEVICE`).
 */
export async function establishSession(pair: TokenPair, deviceId: string): Promise<void> {
  await writeSessionCookies(pair);
  await writeDeviceIdCookie(deviceId);
}
