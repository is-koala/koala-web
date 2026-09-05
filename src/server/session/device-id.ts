import "server-only";

import { deviceIdPattern } from "@/server/contract";

/**
 * Tarayıcı profili başına sabit cihaz kimliği.
 *
 * UUID'nin tirelerden arındırılmış hâli tam 32 karakter ve backend'in
 * kabul ettiği alfabede kalır; ayrıca 122 bit rastgelelik taşıdığı için
 * kimlikler arasında çakışma pratikte imkânsızdır.
 */
export function createDeviceId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function isValidDeviceId(candidate: string | undefined | null): boolean {
  return typeof candidate === "string" && deviceIdPattern.test(candidate);
}
