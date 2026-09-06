import { useActionState } from "react";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { fieldError } from "@/lib/form-state";
import type { PendingVerification } from "@/server/profile/profile";

import { initialSettingsActionState, type AccountSettingsViewer } from "./types";

export function ContactSettings({
  viewer,
  updateAction,
  confirmAction,
}: {
  viewer: AccountSettingsViewer;
  updateAction: SettingsAction;
  confirmAction: SettingsAction;
}) {
  return (
    <section className="settings-card" id="iletisim" aria-labelledby="iletisim-baslik">
      <h2 id="iletisim-baslik">İletişim bilgileri</h2>
      <div className="contact-grid">
        <ContactForm
          kind="email"
          title="E-posta"
          current={viewer.email}
          verified={viewer.emailVerified}
          action={updateAction}
          confirmAction={confirmAction}
        />
        <ContactForm
          kind="phone"
          title="Telefon"
          current={viewer.phoneNumber}
          verified={viewer.phoneVerified}
          action={updateAction}
          confirmAction={confirmAction}
        />
      </div>
    </section>
  );
}

function ContactForm({
  kind,
  title,
  current,
  verified,
  action,
  confirmAction,
}: {
  kind: "email" | "phone";
  title: string;
  current: string;
  verified: boolean;
  action: SettingsAction;
  confirmAction: SettingsAction;
}) {
  const [state, submit] = useActionState(action, initialSettingsActionState);

  return (
    <div className="contact-card">
      <h3>{title}</h3>
      <p className="masked-value">{current || "Eklenmemiş"}</p>
      <p className={verified ? "status-pill" : "status-pill status-pill-warn"}>
        {verified ? "Doğrulandı" : "Doğrulanmadı"}
      </p>
      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        <input type="hidden" name="kind" value={kind} readOnly />
        <TextField
          id={`new-${kind}`}
          name="value"
          label={kind === "email" ? "Yeni e-posta" : "Yeni telefon"}
          type={kind === "email" ? "email" : "text"}
          inputMode={kind === "email" ? "email" : "text"}
          autoComplete={kind === "email" ? "email" : "tel"}
          maxLength={kind === "email" ? 254 : 32}
          error={fieldError(state, "value")}
        />
        <SubmitButton
          label={kind === "email" ? "E-postayı değiştir" : "Telefonu değiştir"}
          pendingLabel="Gönderiliyor…"
        />
      </form>
      {state.status === "done" && state.verification ? (
        <VerificationForm verification={state.verification} action={confirmAction} />
      ) : state.status === "done" ? (
        <p className="inline-success" role="status">
          Bilgin güncellendi.
        </p>
      ) : null}
    </div>
  );
}

function VerificationForm({
  verification,
  action,
}: {
  verification: PendingVerification;
  action: SettingsAction;
}) {
  const [state, submit] = useActionState(action, initialSettingsActionState);
  return (
    <form className="form verification-form" action={submit}>
      <p>
        {verification.sentTo} {verification.type === "PHONE" ? "numarasına" : "adresine"} gönderilen
        kodu gir.
      </p>
      <FormAlert state={state} />
      {state.status === "done" ? (
        <p className="inline-success" role="status">
          Doğrulama tamamlandı.
        </p>
      ) : null}
      <input type="hidden" name="verificationId" value={verification.id} readOnly />
      <TextField
        id={`verification-${verification.id}-token`}
        name="token"
        label="Doğrulama kodu"
        inputMode="text"
        autoComplete="one-time-code"
        maxLength={128}
        error={fieldError(state, "token")}
      />
      <SubmitButton label="Kodu doğrula" pendingLabel="Doğrulanıyor…" />
    </form>
  );
}
