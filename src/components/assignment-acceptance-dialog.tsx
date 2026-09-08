"use client";

import type { WorkerAssignment } from "@/assignments/contract";
import { formatAssignmentDate, formatMoney } from "@/components/assignment-presenters";
import { AssignmentDialog } from "@/components/assignment-dialog";

export function AssignmentAcceptanceDialog({
  acceptance,
  currentPage,
  formAction,
  isPending,
  onClose,
}: {
  acceptance: { assignment: WorkerAssignment; fullAddress: string };
  currentPage: number;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <AssignmentDialog
      titleId="assignment-dialog-title"
      title="İşi kabul et"
      subject={acceptance.assignment.title}
      facts={[
        {
          term: "Tarih",
          detail: formatAssignmentDate(
            acceptance.assignment.startsAt,
            acceptance.assignment.endsAt,
          ),
        },
        {
          term: "Kazanç",
          detail: formatMoney(
            acceptance.assignment.workerPayout,
            acceptance.assignment.currency,
          ),
        },
        { term: "Tam adres", detail: acceptance.fullAddress },
      ]}
      fields={
        <>
          <input type="hidden" name="assignmentId" value={acceptance.assignment.id} />
          <input type="hidden" name="currentPage" value={currentPage} />
          {/*
            Karar adı düğmeden gizli alana taşındı: kabuk onay düğmesini kendi
            çiziyor ve gövdeye giren değer aynı kalıyor.
          */}
          <input type="hidden" name="decision" value="accept" />
        </>
      }
      confirmLabel="Kabulü onayla"
      pendingLabel="Yanıt gönderiliyor"
      pending={isPending}
      formAction={formAction}
      onClose={onClose}
    />
  );
}
