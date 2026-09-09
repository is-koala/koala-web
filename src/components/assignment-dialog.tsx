"use client";

import type { ReactNode } from "react";

/**
 * Geri alınamaz bir kabulün son kontrol diyaloğu.
 *
 * İki ekran aynı kararı veriyor — işçi bir atama teklifini, işveren bir
 * başvuruyu kabul ediyor — ve ikisinde de kabul, tam iş adresini karşı tarafa
 * açan geri alınamaz bir adım. Kabuk bu yüzden ortak: aynı arka plan, aynı
 * "Son kontrol" bandı, aynı gerçek listesi ve aynı "Vazgeç" yolu. Ayrışan
 * yalnız üç `<dt>/<dd>` ve formun gövdesi.
 *
 * Kabuk formu **kendi çiziyor**, çağıran yalnız gizli alanları veriyor:
 * onaylama düğmesinin kapısı ve bekleme metni de kabuğun işi, yoksa üçüncü
 * bir kopya o düğmeyi kapıdan geçirmeyi unutabilirdi.
 */
export function AssignmentDialog({
  titleId,
  title,
  subject,
  facts,
  fields,
  confirmLabel,
  pendingLabel,
  pending,
  blockedReason = null,
  formAction,
  onClose,
}: {
  titleId: string;
  title: string;
  /** Başlığın altındaki tekil kayıt: ilanın başlığı ya da adayın adı. */
  subject: string;
  facts: readonly { readonly term: string; readonly detail: ReactNode }[];
  /** Formun gizli alanları; gönderilen gövdeyi çağıran kuruyor. */
  fields: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  /**
   * Onay kapalıysa nedeni; açıkken `null`.
   *
   * Diyalog açıkken durum değişebiliyor: yandaki kart kabul edilip kontenjan
   * dolduğunda bu düğme hâlâ canlı kalırdı.
   */
  blockedReason?: string | null;
  formAction: (formData: FormData) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="assignment-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <section className="assignment-dialog">
        <p className="eyebrow">Son kontrol</p>
        <h2 id={titleId}>{title}</h2>
        <h3>{subject}</h3>
        <dl className="assignment-dialog-facts">
          {facts.map((fact) => (
            <div key={fact.term}>
              <dt>{fact.term}</dt>
              <dd>{fact.detail}</dd>
            </div>
          ))}
        </dl>
        {blockedReason ? <p className="muted">{blockedReason}</p> : null}
        <div className="assignment-dialog-actions">
          <form action={formAction} onSubmit={onClose}>
            {fields}
            <button
              className="button button-primary button-small"
              type="submit"
              disabled={blockedReason !== null || pending}
              data-disabled-kind={blockedReason !== null ? "permanent" : undefined}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </form>
          <button
            className="button button-secondary button-small"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            Vazgeç
          </button>
        </div>
      </section>
    </div>
  );
}
