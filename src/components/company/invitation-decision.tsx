"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormAlert } from "@/components/states";
import { idleFormState, type FormAction } from "@/lib/form-state";

/**
 * Davetin iki kararı, tek uç.
 *
 * `POST /contact-invitations/{invitationId}` hem kabulü hem reddi karşılıyor;
 * ayıran şey gövdedeki `accepted`. Bayrak iki düğmede de **açıkça** yazılı
 * çünkü `accepted` `@NotNull`: gövdesiz bir gönderim alan doğrulamasına
 * takılır ve kullanıcıya hiçbir şey anlatmayan bir 400 döner.
 *
 * Ret kabul kadar görünür: davet e-postası zaten reddetme hakkını söylüyor ve
 * ekranın onu saklaması kullanıcıyı kabul etmeye iterdi. Onay adımı yalnız
 * rette, çünkü kabul kullanıcıyı şirket profiline götürüp ne olduğunu
 * gösteriyor; ret ise sessizce ve geri alınamaz biçimde kapanıyor.
 */
export function InvitationDecisionForm({
  action,
  companyName,
}: {
  action: FormAction;
  companyName: string;
}) {
  const [state, submit] = useActionState(action, idleFormState);
  const [confirmingRejection, setConfirmingRejection] = useState(false);

  /*
   * Kabul bu noktaya hiç düşmüyor: sunucu action'ı şirket profiline
   * yönlendiriyor ve form geride kalmıyor. `done` yalnız reddin sonucu.
   */
  if (state.status === "done") {
    return (
      <div className="state-card" role="status">
        <h2>Daveti reddettin</h2>
        <p>
          {companyName} şirketine katılmadın ve hesabında hiçbir şey değişmedi. Kararı geri
          almanın bir yolu yok; fikrini değiştirirsen şirket yöneticisinden yeni bir davet
          istemen gerekiyor.
        </p>
        <Link className="text-link" href="/">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  return (
    <form className="form" action={submit}>
      <FormAlert state={state} />

      {confirmingRejection ? (
        <>
          <p>
            {companyName} şirketinin davetini reddetmek üzeresin. Cevap <strong>geri
            alınamıyor</strong> ve aynı davet ikinci kez cevaplanamıyor.
          </p>
          <div className="button-row">
            <DecisionButton
              accepted={false}
              className="button button-danger"
              label="Evet, reddet"
              pendingLabel="Reddediliyor…"
            />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirmingRejection(false)}
            >
              Vazgeç
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <DecisionButton
            accepted
            className="button button-primary"
            label="Daveti kabul et"
            pendingLabel="Kabul ediliyor…"
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setConfirmingRejection(true)}
          >
            Daveti reddet
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Kararı gövdeye yazan gönder düğmesi.
 *
 * Değer `formData` üzerinden gidiyor (`name`/`value`), bir React durumundan
 * değil: JavaScript çalışmasa da form aynı gövdeyi taşır ve iki düğme
 * arasındaki fark sunucuda okunabilir kalır.
 */
function DecisionButton({
  accepted,
  className,
  label,
  pendingLabel,
}: {
  accepted: boolean;
  className: string;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      name="accepted"
      value={String(accepted)}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
