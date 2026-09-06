import "server-only";

import { apiFetch } from "@/server/api/client";
import { ApiError } from "@/server/api/errors";
import { backendPaths, notFoundStatus, unauthorizedStatus } from "@/server/contract";
import { writeDeviceIdCookie, writeSessionCookies } from "@/server/session/cookies";
import type { TokenPair } from "@/server/session/refresh";
import { anonymousCaller } from "@/server/session/session";

export type Credentials = {
  email: string;
  password: string;
};

/**
 * Giriş reddedildiğinde kullanıcıya söylenen tek şey.
 *
 * Backend bugün kayıtlı olmayan adrese 404 `USER_NOT_FOUND_BY_EMAIL`
 * (`UserManager.getByEmail`), yanlış parolaya 401
 * `AUTH_EMAIL_OR_PASSWORD_MISMATCH` döndürüyor. İkisi ayrışırsa giriş formu
 * hangi adreslerin kayıtlı olduğunu söyler; üstelik 404 ailesi kullanıcıya
 * "Aradığın içerik bulunamadı" yazdırır. Backend'in iki durumu da 401'e
 * çekmesi is-koala/koala-backend#42 ile ayrı izleniyor; o düzeltme inince
 * burada 404 hiç görülmez ve indirgeme kendiliğinden etkisiz kalır.
 */
const credentialFailure = {
  status: unauthorizedStatus,
  errorCode: "AUTH_EMAIL_OR_PASSWORD_MISMATCH",
  errorCategory: "INVALID_CREDENTIALS",
  /** Kayıt ve ayıklama için; kullanıcıya `errorCode` üzerinden metin seçilir. */
  message: "Giris reddedildi.",
} as const;

/**
 * E-posta ve parolayla oturum açar.
 *
 * Başarıda tokenlar oturum katmanının çerezlerine yazılır; çağıran token
 * görmez. Başarısızlıkta kullanıcı sayımına kapı açmayan tek bir `ApiError`
 * fırlatılır.
 */
export async function signIn(credentials: Credentials): Promise<void> {
  const caller = await anonymousCaller();

  let session: TokenPair;
  try {
    session = await apiFetch<TokenPair>(backendPaths.login, {
      ...caller,
      method: "POST",
      body: credentials,
    });
  } catch (error) {
    throw collapseCredentialFailure(error);
  }

  await writeSessionCookies(session);
  // Oturum bu kimliğe bağlandı; çerez başka bir kimlik taşıyorsa backend
  // sonraki istekte oturumu pasifleştirirdi.
  await writeDeviceIdCookie(caller.deviceId);
}

/**
 * İndirgeme koda değil duruma bakar. Kod eşlemesine güvenmek zarf okunamayan
 * bir 404'te delinirdi: `apiFetch` o durumda koda `UNEXPECTED` düşürüyor ve
 * sunum yine 404 ailesine kayıyordu. Giriş ucunda 401 de 404 de kullanıcı
 * için tek bir şey demek — bilgiler uyuşmadı.
 */
function collapseCredentialFailure(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.status !== unauthorizedStatus && error.status !== notFoundStatus) return error;

  // Ham mesaj da taşınmıyor: "Kullanici bulunamadi" ile "parola hatali"
  // arasındaki fark kayıtlı adresleri ele verirdi.
  return new ApiError({ ...credentialFailure, correlationId: error.correlationId });
}
