"use client";

import { useActionState, useState, useTransition } from "react";

import {
  type AssignmentAcceptanceAction,
  idleAssignmentResponseState,
  type AssignmentResponseAction,
  type WorkerAssignment,
  type WorkerAssignmentPage,
} from "@/assignments/contract";
import { AssignmentAcceptanceDialog } from "@/components/assignment-acceptance-dialog";
import { AssignmentCard } from "@/components/assignment-card";
import { EmptyState, ErrorState } from "@/components/states";

export function AssignmentList({
  initialPage,
  respondAction,
  acceptanceAction,
}: {
  initialPage: WorkerAssignmentPage;
  respondAction: AssignmentResponseAction;
  acceptanceAction: AssignmentAcceptanceAction;
}) {
  const [state, formAction, isPending] = useActionState(
    respondAction,
    idleAssignmentResponseState,
  );
  const [acceptance, setAcceptance] = useState<{
    assignment: WorkerAssignment;
    fullAddress: string;
  } | null>(null);
  const [acceptanceFailure, setAcceptanceFailure] = useState<{
    errorCode: string;
    httpStatus: number;
  } | null>(null);
  const [isAcceptancePending, startAcceptanceTransition] = useTransition();
  const page = state.status === "idle" ? initialPage : (state.assignments ?? initialPage);
  const awaitingResponse = page.content.filter(
    (assignment) => assignment.status === "PENDING_CONFIRMATION",
  );
  const answered = page.content.filter(
    (assignment) => assignment.status !== "PENDING_CONFIRMATION",
  );

  function prepareAcceptance(assignment: WorkerAssignment) {
    setAcceptanceFailure(null);
    startAcceptanceTransition(async () => {
      const result = await acceptanceAction(assignment.id, assignment.jobId);
      if (result.status === "done") {
        setAcceptance({ assignment, fullAddress: result.fullAddress });
      } else {
        setAcceptanceFailure(result);
      }
    });
  }

  return (
    <div className="assignment-list" aria-busy={isPending}>
      {state.status === "error" ? (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      ) : null}
      {acceptanceFailure ? (
        <ErrorState
          errorCode={acceptanceFailure.errorCode}
          status={acceptanceFailure.httpStatus}
        />
      ) : null}

      {page.content.length === 0 ? <EmptyState kind="assignments" /> : null}

      {awaitingResponse.length > 0 ? (
        <section
          className="assignment-section assignment-section-pending"
          aria-labelledby="pending-assignments-heading"
        >
          <div className="assignment-section-heading">
            <p className="eyebrow">Yanıtın gerekiyor</p>
            <h2 id="pending-assignments-heading">Onayını bekleyen işler</h2>
          </div>
          <div className="assignment-grid">
            {awaitingResponse.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                formAction={formAction}
                currentPage={page.page}
                disabled={isPending || isAcceptancePending}
                onPrepareAcceptance={prepareAcceptance}
              />
            ))}
          </div>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section className="assignment-section" aria-labelledby="answered-assignments-heading">
          <div className="assignment-section-heading">
            <p className="eyebrow">Güncel durum</p>
            <h2 id="answered-assignments-heading">
              {awaitingResponse.length > 0 ? "Diğer atamalar" : "Atamalar"}
            </h2>
          </div>
          <div className="assignment-grid">
            {answered.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                formAction={formAction}
                currentPage={page.page}
                disabled={isPending || isAcceptancePending}
                onPrepareAcceptance={prepareAcceptance}
              />
            ))}
          </div>
        </section>
      ) : null}

      {page.totalPages > 1 || page.page > 0 ? (
        <nav className="assignment-pagination" aria-label="Atama sayfaları">
          <form action={formAction}>
            <input type="hidden" name="decision" value="page" />
            <input type="hidden" name="targetPage" value={Math.max(0, page.page - 1)} />
            <button
              className="button button-secondary button-small"
              disabled={page.first || isPending}
              data-disabled-kind={page.first ? "permanent" : undefined}
            >
              Önceki sayfa
            </button>
          </form>
          <span>
            Sayfa {page.page + 1} / {Math.max(page.totalPages, 1)}
          </span>
          <form action={formAction}>
            <input type="hidden" name="decision" value="page" />
            <input type="hidden" name="targetPage" value={page.page + 1} />
            <button
              className="button button-secondary button-small"
              disabled={page.last || isPending}
              data-disabled-kind={page.last ? "permanent" : undefined}
            >
              Sonraki sayfa
            </button>
          </form>
        </nav>
      ) : null}

      {acceptance ? (
        <AssignmentAcceptanceDialog
          acceptance={acceptance}
          currentPage={page.page}
          formAction={formAction}
          isPending={isPending}
          onClose={() => setAcceptance(null)}
        />
      ) : null}
    </div>
  );
}
