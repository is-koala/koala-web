import "server-only";

import { apiRequest } from "@/server/session/session";
import { backendPaths } from "@/server/contract";
import { serverEnvironment } from "@/server/env";

type BackendRealtimeCredential = {
  token: string;
  expiresAt: string;
};

export type RealtimeBootstrap = BackendRealtimeCredential & {
  webSocketUrl: string;
};

/**
 * Tarayıcının ana erişim tokenını görmeden STOMP açabildiği sunucu seam'i.
 * Dönen scoped kimlik yalnız çağıranın belleğinde yaşar; URL sorgusuna,
 * çereze veya sunucu loguna yazılmaz.
 */
export async function issueRealtimeBootstrap(): Promise<RealtimeBootstrap> {
  const credential = await apiRequest<unknown>(backendPaths.realtimeCredential, {
    method: "POST",
    cache: "no-store",
  });

  if (!isRealtimeCredential(credential)) {
    throw new Error("Gerçek zamanlı bağlantı kimliği okunamadı.");
  }

  return {
    ...credential,
    webSocketUrl: webSocketUrl(serverEnvironment().apiUrl),
  };
}

function isRealtimeCredential(value: unknown): value is BackendRealtimeCredential {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BackendRealtimeCredential>;
  return typeof candidate.token === "string" && candidate.token.length > 0 &&
    typeof candidate.expiresAt === "string" && Number.isFinite(Date.parse(candidate.expiresAt));
}

function webSocketUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API_URL yalnız HTTP veya HTTPS kullanabilir.");
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.toString();
}
