"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { DoneNotice } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { idleFormState, type FormAction } from "@/lib/form-state";

/**
 * Bir yetkiliyi çıkarmanın onay adımı.
 *
 * Onay ayrı bir adım, çünkü çıkarmanın geri dönüşü yok: kişiyi geri
 * eklemenin tek yolu yeni bir davet ve davet ancak kişi kabul ederse geçerli
 * oluyor. Onay metni **adla** kuruluyor — `SafeUserDto` e-posta taşımıyor,
 * yani ekranda kişiyi ayırt eden başka bir alan yok.
 *
 * `window.confirm` kullanılmıyor: JavaScript kapalıyken sessizce kaybolur ve
 * ekran okuyucuya sayfanın kendi içeriği gibi görünmez.
 */
export function ContactRemoveForm({ action, personName }: { action: FormAction; personName: string }) {
  const [state, submit] = useActionState(action, idleFormState);
  const [confirming, setConfirming] = useState(false);

  if (state.status === "done") {
    return <DoneNotice title="Yetkili çıkarıldı">{personName} artık şirketin yetkilisi değil.</DoneNotice>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="button button-secondary button-small"
        onClick={() => setConfirming(true)}
      >
        Yetkiliyi çıkar
      </button>
    );
  }

  return (
    <form className="delete-form" action={submit}>
      <FormAlert state={state} />
      <p>{personName} şirketin yetkili listesinden çıkarılsın mı? Geri almak için yeniden davet etmen gerekir.</p>
      <div className="button-row">
        <ConfirmButton />
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => setConfirming(false)}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-danger button-small" type="submit" disabled={pending}>
      {pending ? "Çıkarılıyor…" : "Evet, çıkar"}
    </button>
  );
}
