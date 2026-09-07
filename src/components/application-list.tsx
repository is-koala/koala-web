"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  idleApplicationMutationState,
  type ApplicationFilter,
  type ApplicationMutationAction,
  type ApplicationStatus,
  type WorkerApplication,
  type WorkerApplicationPage,
} from "@/applications/contract";
import { ErrorState } from "@/components/states";
import { formatDateTime, formatJobDate } from "@/lib/dates";
import { safeImageUrl } from "@/lib/urls";

type ApplicationListProps = {
  initialPage: WorkerApplicationPage;
  filter: ApplicationFilter;
  action: ApplicationMutationAction;
  requestPage?: number;
};

export function ApplicationList({
  initialPage,
  filter,
  action,
  requestPage,
}: ApplicationListProps) {
  return (
    <ApplicationListState
      key={`${filter}:${requestPage ?? initialPage.page}`}
      initialPage={initialPage}
      filter={filter}
      action={action}
    />
  );
}

function ApplicationListState({
  initialPage,
  filter,
  action,
}: Omit<ApplicationListProps, "requestPage">) {
  const [state, formAction, isPending] = useActionState(action, idleApplicationMutationState);
  const [withdrawal, setWithdrawal] = useState<WorkerApplication | null>(null);
  const page = state.status === "idle" ? initialPage : (state.applications ?? initialPage);

  return (
    <div className="application-list" aria-busy={isPending}>
      <nav className="application-filters" aria-label="Başvuru durumu">
        {filterOptions.map((option) => (
          <Link
            key={option.value}
            href={applicationListHref(option.value, 0)}
            aria-current={filter === option.value ? "page" : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {state.status === "error" ? (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      ) : null}

      {page.content.length === 0 ? <ApplicationEmpty filter={filter} /> : (
        <div className="application-grid">
          {page.content.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              disabled={isPending}
              onWithdraw={setWithdrawal}
            />
          ))}
        </div>
      )}

      {page.totalPages > 1 || page.page > 0 ? (
        <nav className="application-pagination" aria-label="Başvuru sayfaları">
          {page.first ? <span /> : (
            <Link href={applicationListHref(filter, Math.max(0, page.page - 1))}>Önceki sayfa</Link>
          )}
          <span>Sayfa {page.page + 1} / {Math.max(page.totalPages, 1)}</span>
          {page.last ? <span /> : (
            <Link href={applicationListHref(filter, page.page + 1)}>Sonraki sayfa</Link>
          )}
        </nav>
      ) : null}

      {withdrawal ? (
        <div
          className="application-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="application-dialog-title"
        >
          <section className="application-dialog">
            <p className="eyebrow">Onay gerekiyor</p>
            <h2 id="application-dialog-title">Başvuruyu geri çek</h2>
            <p>
              <strong>{withdrawal.title}</strong> başvurunu geri çekmek istediğine emin misin?
            </p>
            <div className="application-dialog-actions">
              <form action={formAction} onSubmit={() => setWithdrawal(null)}>
                <input type="hidden" name="applicationId" value={withdrawal.id} />
                <input type="hidden" name="filter" value={filter} />
                <input type="hidden" name="page" value={page.page} />
                <button className="button button-danger button-small" disabled={isPending}>
                  {isPending ? "Geri çekiliyor" : "Geri çekmeyi onayla"}
                </button>
              </form>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => setWithdrawal(null)}
                disabled={isPending}
              >
                Vazgeç
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  application,
  disabled,
  onWithdraw,
}: {
  application: WorkerApplication;
  disabled: boolean;
  onWithdraw: (application: WorkerApplication) => void;
}) {
  const titleId = `application-${application.id}`;
  const location = [application.districtName, application.cityName].filter(Boolean).join(", ");
  return (
    <article className="application-card" aria-labelledby={titleId}>
      <ApplicationCover application={application} />
      <div className="application-card-body">
        <span className={`application-status application-status-${application.status.toLowerCase()}`}>
          {statusLabels[application.status]}
        </span>
        <div>
          <h2 id={titleId}>{application.title}</h2>
          {application.companyName ? <p className="application-company">{application.companyName}</p> : null}
          {application.position ? <p className="application-position">{application.position}</p> : null}
        </div>
        <dl className="application-facts">
          <div><dt>İş tarihi</dt><dd>{formatJobDate(application.startsAt)}</dd></div>
          {location ? <div><dt>Konum</dt><dd>{location}</dd></div> : null}
          <div><dt>Başvuru tarihi</dt><dd>{formatDateTime(application.appliedAt)}</dd></div>
        </dl>
        {application.notes ? (
          <div className="application-note"><h3>Başvuru notun</h3><p>{application.notes}</p></div>
        ) : null}
        {application.status === "REJECTED" && application.rejectionReason ? (
          <div className="application-rejection"><h3>Ret gerekçesi</h3><p>{application.rejectionReason}</p></div>
        ) : null}
        {application.status === "ACCEPTED" && application.assignmentId ? (
          <div className="application-assignment">
            <span>Atama: <code>{application.assignmentId}</code></span>
            <Link className="button button-primary button-small" href="/panel/islerim">Atamayı gör</Link>
          </div>
        ) : null}
        {application.status === "APPLIED" ? (
          <button
            type="button"
            className="button button-secondary button-small application-withdraw"
            onClick={() => onWithdraw(application)}
            disabled={disabled}
          >
            Başvuruyu geri çek
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ApplicationCover({ application }: { application: WorkerApplication }) {
  const imageUrl = safeImageUrl(application.coverImageUrl);
  if (!imageUrl) {
    return <div className="application-cover application-cover-empty">İlan görseli yok</div>;
  }
  return (
    <div
      className="application-cover"
      role="img"
      aria-label={`${application.title} kapak görseli`}
      style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
    />
  );
}

function ApplicationEmpty({ filter }: { filter: ApplicationFilter }) {
  return (
    <div role="status" className="state-card">
      <h2>{filter === "ALL" ? "Henüz başvuru yok" : "Bu filtrede başvuru yok"}</h2>
      <p>
        {filter === "ALL"
          ? "İlanlara yaptığın başvurular burada görünecek."
          : "Başka bir durum filtresi seçerek başvurularını inceleyebilirsin."}
      </p>
    </div>
  );
}

export function applicationListHref(filter: ApplicationFilter, page: number): string {
  const search = new URLSearchParams();
  if (filter !== "ALL") search.set("status", filter);
  search.set("page", String(page));
  return `/panel/basvurularim?${search}`;
}

const filterOptions: ReadonlyArray<{ value: ApplicationFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "APPLIED", label: "Bekleyenler" },
  { value: "ACCEPTED", label: "Kabul edilenler" },
  { value: "REJECTED", label: "Reddedilenler" },
  { value: "WITHDRAWN", label: "Geri çekilenler" },
];

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Başvuru gönderildi",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri çekildi",
  UNKNOWN: "Durum güncelleniyor",
};
