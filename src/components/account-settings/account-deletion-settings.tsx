"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type {
  AccountDeletionAction,
  AccountDeletionActionState,
} from "@/app/(uygulama)/hesap-actions";
import { CheckboxField, TextareaField } from "@/components/form-controls";
import { ErrorState, FormAlert } from "@/components/states";
import type {
  AccountDeletion,
  AccountDeletionLoadState,
} from "@/server/account-settings/settings";

import { formatAccountDate } from "./presentation";

const initialActionState: AccountDeletionActionState = { status: "idle" };

export function AccountDeletionSettings({
  initialStatus,
  action,
}: {
  initialStatus: AccountDeletionLoadState;
  action: AccountDeletionAction;
}) {
  const [actionState, submit] = useActionState(action, initialActionState);
  const status = actionState.status === "done"
    ? { kind: "request" as const, deletion: actionState.deletion }
    : initialStatus;

  return (
    <section className="settings-card" id="hesap-silme" aria-label="Hesap silme">
      <div className="settings-heading">
        <div>
          <h2>Hesap silme</h2>
          <p>Talep işlendiğinde bu işlem geri alınamaz.</p>
        </div>
        <Link className="text-link" href="/iletisim">Destekten yardım al</Link>
      </div>

      <p>
        Talebin bekleme süresi ile devam eden iş, uyuşmazlık ve ödeme kontrolleri
        tamamlandıktan sonra işlenir. Yasal olarak saklanması gereken ödeme, fatura ve
        sözleşme kayıtları kimliğinden ayrıştırılmış biçimde tutulabilir.
      </p>

      {status.kind === "error" ? (
        <DeletionError status={status} />
      ) : status.kind === "request" ? (
        <>
          <DeletionStatus deletion={status.deletion} duplicate={actionState.status === "done" && actionState.outcome === "already-requested"} />
          {status.deletion.status === "REJECTED" ? (
            <DeletionRequestForm
              actionState={actionState}
              submit={submit}
              submitLabel="Yeni silme talebi oluştur"
            />
          ) : null}
        </>
      ) : (
        <DeletionRequestForm actionState={actionState} submit={submit} submitLabel="Silme talebi oluştur" />
      )}
    </section>
  );
}

function DeletionRequestForm({
  actionState,
  submit,
  submitLabel,
}: {
  actionState: AccountDeletionActionState;
  submit: (formData: FormData) => void;
  submitLabel: string;
}) {
  return (
    <form className="form settings-form" action={submit}>
      {actionState.status === "error" ? <FormAlert state={actionState} /> : null}
      {actionState.status === "error" && actionState.requestId ? (
        <RequestReference requestId={actionState.requestId} />
      ) : null}
      <TextareaField
        name="reason"
        label="Silme nedeni (isteğe bağlı)"
        defaultValue=""
        rows={4}
        maxLength={512}
        hint="Bu alan isteğe bağlıdır ve en fazla 512 karakter olabilir."
        error={actionState.status === "error" ? actionState.fieldErrors?.reason : undefined}
      />
      <CheckboxField
        name="confirmation"
        value="account-deletion-irrevocable"
        required
        error={actionState.status === "error" ? actionState.fieldErrors?.confirmation : undefined}
      >
        Hesabım işlendiğinde bu işlemin geri alınamayacağını anlıyorum.
      </CheckboxField>
      <DeletionSubmitButton label={submitLabel} />
    </form>
  );
}

function DeletionStatus({
  deletion,
  duplicate,
}: {
  deletion: AccountDeletion;
  duplicate: boolean;
}) {
  if (deletion.status === "REQUESTED") {
    return (
      <div className="state-card" role="status">
        <h3>{duplicate ? "Talebin zaten sırada" : "Talebin alındı"}</h3>
        <p>
          Hesabın bekleme süresi ve uygunluk kontrollerinden sonra anonimleştirilecek.
          Oturumun bu sırada açık kalır; güncel durumu buradan takip edebilirsin.
        </p>
        <p className="muted">Talep tarihi: {formatAccountDate(deletion.requestedAt)}</p>
        {deletion.blockedReason?.trim() ? (
          <div className="form-warning" role="note">
            <strong>İşlemi bekleten durum</strong>
            <p>{deletion.blockedReason}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (deletion.status === "ANONYMIZED") {
    return (
      <div className="state-card" role="status">
        <h3>Hesabın anonimleştirildi</h3>
        <p>Silme talebi tamamlandı; bu hesapla açık oturumlar artık kullanılamaz.</p>
        <p className="muted">Tamamlanma tarihi: {formatAccountDate(deletion.processedAt)}</p>
      </div>
    );
  }

  if (deletion.status === "REJECTED") {
    return (
      <div className="state-card" role="status">
        <h3>Talebin sonuçlandırılamadı</h3>
        <p>Durumu açıklığa kavuşturmak için destek ekibiyle iletişime geçebilirsin.</p>
        {deletion.blockedReason?.trim() ? <p>{deletion.blockedReason}</p> : null}
        <p className="muted">Sonuç tarihi: {formatAccountDate(deletion.processedAt)}</p>
      </div>
    );
  }

  return (
    <div className="state-card state-card-error" role="alert">
      <h3>Talep durumu doğrulanamadı</h3>
      <p>Hesap silme durumunda bilinmeyen bir değişiklik var. Yeni talep oluşturmadan destekten yardım al.</p>
    </div>
  );
}

function DeletionError({
  status,
}: {
  status: Extract<AccountDeletionLoadState, { kind: "error" }>;
}) {
  const router = useRouter();

  return (
    <div>
      <ErrorState
        errorCode={status.errorCode}
        status={status.httpStatus}
        onRetry={() => router.refresh()}
      />
      {status.requestId ? <RequestReference requestId={status.requestId} /> : null}
    </div>
  );
}

function RequestReference({ requestId }: { requestId: string }) {
  return <p className="muted">Destek kodu: <code>{requestId}</code></p>;
}

function DeletionSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-danger" type="submit" disabled={pending}>
      {pending ? "Talep oluşturuluyor…" : label}
    </button>
  );
}
