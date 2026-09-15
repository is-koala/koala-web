/**
 * Oturum ayrıntısının ekran ile sunucu arasında paylaşılan biçimi
 * (is-koala/koala-web#188). Sunucu modülü `server-only`; istemci bileşeni
 * tipleri ve sınırları buradan okur.
 */

/** `LoginHistoryEntryDto`: cihazın son girişlerinden biri (en fazla 20). */
export type LoginHistoryEntry = {
  at: string | null;
  ipAddress: string | null;
  location: string | null;
  success: boolean;
};

/**
 * `SessionDetailDto` (backend 0.9.28, koala-backend#306).
 *
 * Boş alanlar ekrana `null` olarak gelir; sayfa her birinde "—" yazıyor ve
 * hiçbirini zorunlu saymıyor: IP ve konum eski oturumlarda hiç yazılmamış
 * olabiliyor, giriş geçmişi ise yalnız güncellemeden sonraki girişleri
 * kapsıyor.
 */
export type SessionDetail = {
  id: string;
  deviceId: string;
  deviceType: string;
  /** Gösterilen ad: kullanıcı adlandırdıysa o, yoksa otomatik üretilen. */
  deviceName: string | null;
  /** Kullanıcının verdiği ad; formun başlangıç değeri. */
  deviceCustomName: string | null;
  ipAddress: string | null;
  location: string | null;
  createdAt: string | null;
  lastAccessedAt: string | null;
  refreshExpiresAt: string | null;
  current: boolean;
  logins: number;
  loginHistory: readonly LoginHistoryEntry[];
};

/** `RenameDeviceDto.name`: `@Size(max = 60)`. */
export const deviceNameMaxLength = 60;

/** Geçmişte en fazla kaç giriş döner; `SessionManager.LOGIN_HISTORY_SIZE`. */
export const loginHistorySize = 20;
