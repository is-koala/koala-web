"use client";

import { useActionState } from "react";

import { FileField, SubmitButton } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { idleFormState, type FormAction } from "@/lib/form-state";
import type { Company } from "@/server/company/company";

import { logoAccept, logoHint } from "./logo";

/**
 * Logo değiştirme ve kaldırma.
 *
 * Şirket bilgilerinin kaydedilmesinden **ayrı** iki eylem, çünkü backend'de
 * de ayrı iki uç (`PUT` / `DELETE /companies/{id}/logo`). Kaydetmeye
 * bağlansalardı yalnız logo değiştirmek isteyen kullanıcı beş alanı yeniden
 * göndermek zorunda kalır ve o gönderim kendi hatalarını da getirirdi.
 */
export function CompanyLogoForms({
  company,
  replaceAction,
  removeAction,
}: {
  company: Company;
  replaceAction: FormAction;
  removeAction: FormAction;
}) {
  return (
    <>
      <ReplaceLogoForm action={replaceAction} />
      {/* Kaldırılacak bir şey yokken düğme, hiçbir şeyi değiştirmeyen bir
          istek üretirdi. */}
      {company.logoUrl ? <RemoveLogoForm action={removeAction} /> : null}
    </>
  );
}

function ReplaceLogoForm({ action }: { action: FormAction }) {
  const [state, submit] = useActionState(action, idleFormState);

  return (
    <form className="form compact-form" action={submit} aria-label="Şirket logosu">
      <FormAlert state={state} />
      <FileField
        id="company-logo"
        name="logo"
        label="Yeni logo"
        accept={logoAccept}
        hint={logoHint}
      />
      <SubmitButton label="Logoyu yükle" pendingLabel="Yükleniyor…" />
    </form>
  );
}

function RemoveLogoForm({ action }: { action: FormAction }) {
  const [state, submit] = useActionState(action, idleFormState);

  return (
    <form className="delete-form" action={submit} aria-label="Logoyu kaldır">
      <FormAlert state={state} />
      <SubmitButton label="Logoyu kaldır" pendingLabel="Kaldırılıyor…" />
    </form>
  );
}
