import "server-only";

import type { ConsentDecision } from "@/lib/consents";
import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import type { TokenPair } from "@/server/session/refresh";
import { webDeviceHints } from "@/server/session/device-hints";
import { anonymousCaller } from "@/server/session/session";

import { establishSession } from "./session-start";

/** `AuthStartRegistrationDto`. */
export type StartRegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  isEmployer: boolean;
};

/** `AuthSetPasswordDto`; yanıttaki `isEmployer` bugün hiçbir ekranda okunmuyor. */
export type VerifiedRegistration = {
  setPasswordToken: string;
};

export type CompleteRegistrationInput = {
  setPasswordToken: string;
  password: string;
  consents: readonly ConsentDecision[];
};

/**
 * Doğrulama e-postasını ister.
 *
 * Adres zaten kayıtlıysa backend yine 200 dönüyor (`AuthManager.startRegistration`):
 * kayıtlı e-postaların açığa çıkmaması için. Çağıran da bu ikiliği bozmamalı.
 */
export async function startRegistration(input: StartRegistrationInput): Promise<void> {
  await apiFetch<null>(backendPaths.startRegistration, {
    ...(await anonymousCaller()),
    method: "POST",
    body: input,
  });
}

/**
 * E-postadaki kayıt tokenını doğrular ve parola belirleme tokenını alır.
 *
 * Token tüketilmiyor (`AuthManager.verifyRegistrationToken` yalnız doğrulayıp
 * yeni bir JWT üretiyor), bu yüzden sayfa yenilenince akış bozulmaz — ama
 * her yenileme `AUTH` hız kovasından bir hak yakar.
 */
export async function verifyRegistrationToken(
  registrationToken: string,
): Promise<VerifiedRegistration> {
  return apiFetch<VerifiedRegistration>(backendPaths.verifyRegistrationToken, {
    ...(await anonymousCaller()),
    method: "POST",
    body: { registrationToken },
  });
}

/**
 * Parolayı ve rıza kararlarını yazar; backend 201 ile birlikte oturumu da
 * açtığı için kullanıcı "şimdi giriş yap" adımı görmeden içeri girer.
 */
export async function completeRegistration(input: CompleteRegistrationInput): Promise<void> {
  const caller = await anonymousCaller();

  const session = await apiFetch<TokenPair>(backendPaths.completeRegistration, {
    ...caller,
    method: "POST",
    body: {
      setPasswordToken: input.setPasswordToken,
      password: input.password,
      consents: input.consents,
    },
    // Kayıt da bir oturum açıyor; cihaz adı bu istekte kuruluyor.
    deviceHints: await webDeviceHints(),
  });

  await establishSession(session, caller.deviceId);
}
