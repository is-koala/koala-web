"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";
import { signIn } from "@/server/auth/login";
import { unexpectedError } from "@/server/contract";
import { returnDestination } from "@/server/session/login-redirect";

/**
 * Giriş formunun sunucu tarafı.
 *
 * Tarayıcı backend'e hiç dokunmaz (ADR-0011): form bu action'a gider,
 * tokenlar oturum katmanının HttpOnly çerezlerine yazılır ve kullanıcı
 * bıraktığı sayfaya döner. Hedef gizli alandan geldiği için burada yeniden
 * doğrulanır; tarayıcıdan gelen hiçbir değer güvenilir sayılmaz.
 */
export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const destination = returnDestination(textField(formData, "next"));

  try {
    await signIn({
      email: textField(formData, "email"),
      password: textField(formData, "password"),
    });
  } catch (error) {
    return failureState(error);
  }

  redirect(destination);
}

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Bilinmeyen arıza da kodla taşınır; metin seçimi istemcide yapılır. */
function failureState(error: unknown): FormState {
  if (error instanceof ApiError) {
    return { status: "error", errorCode: error.errorCode, httpStatus: error.status };
  }
  return { status: "error", errorCode: unexpectedError, httpStatus: 500 };
}
