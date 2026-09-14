"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/lib/form-state";
import { signIn } from "@/server/auth/login";
import { failureState, textField } from "@/server/form";
import { postLoginDestination, returnDestination } from "@/server/session/login-redirect";
import { viewerShell } from "@/server/session/viewer";

/**
 * Giriş formunun sunucu tarafı.
 *
 * Tarayıcı backend'e hiç dokunmaz (ADR-0011): form bu action'a gider,
 * tokenlar oturum katmanının HttpOnly çerezlerine yazılır ve kullanıcı
 * bıraktığı sayfaya döner. Hedef gizli alandan geldiği için burada yeniden
 * doğrulanır; tarayıcıdan gelen hiçbir değer güvenilir sayılmaz.
 *
 * Dönülecek sayfa yoksa hedef kullanıcının kabuğu; rol için giriş sonrası
 * bir kez `GET /users/me` okunuyor. Profil okunamazsa giriş yine başarılı —
 * kullanıcı ana sayfaya düşer, hata ekranına değil.
 */
export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const next = textField(formData, "next");

  try {
    await signIn({
      email: textField(formData, "email"),
      password: textField(formData, "password"),
    });
  } catch (error) {
    return failureState(error);
  }

  const shell = returnDestination(next) === null ? await viewerShell() : null;
  redirect(postLoginDestination(next, shell));
}
