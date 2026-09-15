import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { SessionDetail } from "@/lib/session-detail";
import { ApiError } from "@/server/api/errors";
import { backendPaths, notFoundStatus } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

export type { LoginHistoryEntry, SessionDetail } from "@/lib/session-detail";

type LoginHistoryEntryDto = {
  at?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  success?: boolean | null;
};

type SessionDetailDto = {
  id?: string;
  deviceId?: string;
  deviceType?: string | null;
  deviceName?: string | null;
  deviceCustomName?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  createdAt?: string | null;
  lastAccessedAt?: string | null;
  refreshExpiresAt?: string | null;
  current?: boolean | null;
  logins?: number | null;
  loginHistory?: readonly LoginHistoryEntryDto[] | null;
};

/**
 * Bir oturumun ayrıntısı; `null` "yok" demek.
 *
 * Backend başkasının oturumunu, kapatılmış oturumu ve hiç var olmayanı aynı
 * 404 ile döndürüyor (`Concealment.notFound`) — sayfa da üçünü ayırt etmez.
 * 405 de `null`: 0.9.28 öncesi sunucuda bu yol yalnız `DELETE` biliyor ve
 * Spring `GET`'e 405 dönüyor; hesap sayfası bunu "ayrıntı yok" diye okuyup
 * satırları bağlantısız bırakıyor, sayfa ise 404 çiziyor.
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const dto = await fetchDetailOrNull(sessionId);
  return dto === null ? null : sessionDetailView(dto, sessionId);
}

/**
 * Sunucu ayrıntı ucunu biliyor mu.
 *
 * Liste DTO'su 0.9.28'de değişmedi, yani eski sunucuyu listeden anlamanın
 * bir yolu yok; tek yol ucu bir kez denemek. Yalnız bu isteğin **kendi**
 * oturumuyla denenir: az önce bu tokenla kimlik doğrulandı, yani yeni
 * sunucuda 404 dönemez — 404 ya da 405 yalnız eski sunucudan gelir. Başka bir
 * oturumla denemek bu çıkarımı bozardı (listeden sonra kapatılmış oturum
 * 404 verir ve bütün bağlantılar sessizce kaybolurdu). Öbür hatalar "var"
 * sayılır: geçici bir arıza satırları bağlantısız bırakmamalı, sayfa kendi
 * hata kartını çizer. Deneme tam ayrıntıyı indiriyor; daha hafif bir uç yok.
 */
export async function isSessionDetailAvailable(currentSessionId: string): Promise<boolean> {
  try {
    return (await fetchDetailOrNull(currentSessionId)) !== null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return true;
    throw error;
  }
}

/**
 * Ayrıntı ucunun tek okuma yolu: 404 ve 405 `null`, gövdesiz 200 de `null`
 * (backend zarfı boş döndürmez ama `apiFetch` onu `null` olarak geçiriyor).
 * Oturum bitmişse `apiRequest` girişe yönlendirir; o kontrol akışı burada
 * yutulmaz.
 */
async function fetchDetailOrNull(sessionId: string): Promise<SessionDetailDto | null> {
  try {
    return await apiRequest<SessionDetailDto | null>(backendSessionPath(sessionId), {
      cache: "no-store",
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && isDetailUnavailable(error.status)) return null;
    throw error;
  }
}

/** `PATCH /users/me/devices/{deviceId}`; 400 boş ya da uzun ad, 404 başkasının cihazı. */
export async function renameDevice(deviceId: string, name: string): Promise<void> {
  await apiRequest(`${backendPaths.devices}/${encodeURIComponent(deviceId)}`, {
    method: "PATCH",
    body: { name },
  });
}

export function sessionDetailView(dto: SessionDetailDto, sessionId: string): SessionDetail {
  return {
    id: dto.id ?? sessionId,
    deviceId: dto.deviceId ?? "",
    deviceType: dto.deviceType ?? "UNKNOWN",
    deviceName: text(dto.deviceName),
    deviceCustomName: text(dto.deviceCustomName),
    ipAddress: text(dto.ipAddress),
    location: text(dto.location),
    createdAt: text(dto.createdAt),
    lastAccessedAt: text(dto.lastAccessedAt),
    refreshExpiresAt: text(dto.refreshExpiresAt),
    current: dto.current === true,
    logins: typeof dto.logins === "number" && Number.isFinite(dto.logins) ? dto.logins : 0,
    loginHistory: (dto.loginHistory ?? []).map((entry) => ({
      at: text(entry.at),
      ipAddress: text(entry.ipAddress),
      location: text(entry.location),
      success: entry.success === true,
    })),
  };
}

/** Backend yolu; sayfa adresi `app-routes.ts` içindeki `sessionDetailPath`. */
function backendSessionPath(sessionId: string): string {
  return `${backendPaths.sessions}/${encodeURIComponent(sessionId)}`;
}

const methodNotAllowedStatus = 405;

function isDetailUnavailable(status: number): boolean {
  return status === notFoundStatus || status === methodNotAllowedStatus;
}

/** Boş dizeyi de "yok" sayar: ekranda "—" yerine boşluk bırakmasın. */
function text(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
