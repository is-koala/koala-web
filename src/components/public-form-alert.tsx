"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/form-state";
import { loadBackendErrorFamilies } from "@/lib/backend-error-families";

import { PublicErrorState } from "./public-states";

/**
 * Herkese açık formların üst bandı; alan bazlı mesajlar kendi alanlarının
 * altında.
 *
 * Gönderim sürerken aile haritası önden ısıtılır: ret katalogda olmayan bir
 * kodla gelirse kart bir parça daha beklemesin (is-koala/koala-web#184).
 * Harita ilk yüke girmiyor; yalnız kullanıcı formu gönderdiğinde iner.
 * `useFormStatus` yalnız formun içinden okunabildiği için bant formun
 * içinde çizilir ve bu yüzden istemci bileşeni.
 */
export function PublicFormAlert({ state }: { state: FormState }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) void loadBackendErrorFamilies();
  }, [pending]);

  if (state.status !== "error") return null;
  return <PublicErrorState errorCode={state.errorCode} status={state.httpStatus} />;
}
