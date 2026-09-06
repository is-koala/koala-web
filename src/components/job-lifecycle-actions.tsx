"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { errorPresentation } from "@/lib/errors";
import {
  idleJobLifecycleState,
  jobLifecycleActions,
  type JobAction,
  type JobLifecycleOperation,
  type JobLifecycleState,
} from "@/jobs/lifecycle";

type JobLifecycleFormAction = (
  state: JobLifecycleState,
  formData: FormData,
) => Promise<JobLifecycleState>;

/**
 * İlanın durum geçişleri.
 *
 * Mümkün olmayan bir geçiş düğme olarak **çizilmiyor**; yerine nedeni
 * yazılıyor. Kuralı bu bileşen bilmiyor, `jobLifecycleActions` sunucunun
 * kuralını yansıtıyor ve son sözü yine sunucu söylüyor.
 *
 * Geri alınamaz iki eylem de onay adımından geçiyor: gönderim, sonucu
 * okunmuş bir onaydan sonra oluyor.
 */
export function JobLifecycleActions({
  status,
  action,
  initialState = idleJobLifecycleState,
}: {
  status: string;
  action: JobLifecycleFormAction;
  /** Testlerin ve sunucudan gelen ilk durumun giriş noktası. */
  initialState?: JobLifecycleState;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [confirming, setConfirming] = useState<JobAction | null>(null);
  const actions = jobLifecycleActions(status);

  return (
    <section className="job-lifecycle" aria-labelledby="job-lifecycle-title">
      <h2 id="job-lifecycle-title">İlan yönetimi</h2>

      {state.status === "done" ? (
        <p role="status" className="form-notice">
          {doneMessages[state.operation]}
        </p>
      ) : null}

      {state.status === "error" ? <LifecycleFailure state={state} /> : null}

      <ul className="job-lifecycle-list">
        {actions.map((jobAction) => (
          <li key={jobAction.operation}>
            <p className="field-hint">{jobAction.consequence}</p>
            {jobAction.available ? (
              <button
                type="button"
                className="button button-danger button-small"
                disabled={pending}
                onClick={() => setConfirming(jobAction)}
              >
                {jobAction.label}
              </button>
            ) : (
              <p className="muted">{jobAction.blockedReason}</p>
            )}
          </li>
        ))}
      </ul>

      {/*
        İlanın düzenlenmesi bilerek yok: backend'de ilan güncelleme ucu
        bulunmuyor (`JobsController` yalnız kapatma, iptal ve galeri yazıyor).
        Kullanıcının bunu bir eksiklik değil bir kural olarak okuması gerekiyor.
      */}
      <p className="field-hint">
        Yayımlanan bir ilanın bilgileri değiştirilemiyor. Koşulları değiştirmen
        gerekiyorsa ilanı kapatıp yeni bir ilan açman gerekir.
      </p>

      {confirming === null ? null : (
        <ConfirmationDialog
          jobAction={confirming}
          pending={pending}
          onSubmit={submit}
          onDismiss={() => setConfirming(null)}
        />
      )}
    </section>
  );
}

/**
 * Reddin ekrandaki hâli.
 *
 * Metin `errorCode` ile seçiliyor, backend'in ham mesajıyla değil
 * (`AGENTS.md`, "Ekran durumları"). Canlı atama reddi tek istisnayı taşıyor:
 * kullanıcının yapacağı iş bu ekranda değil, atamanın kendi iptal akışında.
 */
function LifecycleFailure({
  state,
}: {
  state: Extract<JobLifecycleState, { status: "error" }>;
}) {
  const presentation = errorPresentation(state.errorCode, state.httpStatus);

  return (
    <p role="alert" className="form-warning">
      <strong>{presentation.title}</strong> {presentation.message}{" "}
      {state.errorCode === "JOB_HAS_LIVE_ASSIGNMENT" ? (
        <Link className="text-link" href="/isveren/atamalar">
          Atamalarına git
        </Link>
      ) : null}
    </p>
  );
}

function ConfirmationDialog({
  jobAction,
  pending,
  onSubmit,
  onDismiss,
}: {
  jobAction: JobAction;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="assignment-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-lifecycle-dialog-title"
    >
      <section className="assignment-dialog">
        <p className="eyebrow">Son kontrol</p>
        <h3 id="job-lifecycle-dialog-title">{jobAction.label}</h3>
        <p>{jobAction.consequence}</p>
        <div className="assignment-dialog-actions">
          <form action={onSubmit} onSubmit={onDismiss}>
            <input type="hidden" name="operation" value={jobAction.operation} />
            <button className="button button-danger button-small" type="submit" disabled={pending}>
              {confirmLabels[jobAction.operation]}
            </button>
          </form>
          <button
            className="button button-secondary button-small"
            type="button"
            onClick={onDismiss}
            disabled={pending}
          >
            Vazgeç
          </button>
        </div>
      </section>
    </div>
  );
}

const confirmLabels: Readonly<Record<JobLifecycleOperation, string>> = {
  close: "Kapatmayı onayla",
  cancel: "İptali onayla",
};

const doneMessages: Readonly<Record<JobLifecycleOperation, string>> = {
  close: "İlan kapatıldı. Aramalarda görünmüyor ve yeni aday bulmuyor.",
  cancel: "İlan iptal edildi. Başvuranlara bildirim gönderildi.",
};
