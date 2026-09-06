"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import {
  captureCheckpointLocation,
  type LocationCapture,
} from "@/assignments/geolocation";
import type {
  CheckpointKind,
  WorkDetail,
  WorkDetailAction,
  WorkDetailActionResult,
  WorkDetailCommand,
} from "@/assignments/work-detail";

import { locationNotice, timesheetErrorMessage } from "./presenters";
import { WorkSecondaryActions } from "./work-secondary-actions";
import { WorkSessions } from "./work-sessions";
import { WorkSummary } from "./work-summary";
import { WorkTimeline } from "./work-timeline";

export function WorkDetailScreen({
  initialDetail,
  action,
  locate = captureCheckpointLocation,
}: {
  initialDetail: WorkDetail;
  action: WorkDetailAction;
  locate?: () => Promise<LocationCapture>;
}) {
  const [detail, setDetail] = useState<WorkDetail | null>(initialDetail);
  const [feedback, setFeedback] = useState<
    { kind: "error" | "notice"; message: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const activeSessionId = detail?.sessions.find((session) => session.checkOutAt === null)?.id;

  const applyResult = useCallback((
    result: WorkDetailActionResult,
    notice: string | null,
  ) => {
    if (result.status === "done") {
      setDetail(result.detail);
      setFeedback(notice ? { kind: "notice", message: notice } : null);
      return;
    }
    if ("detail" in result) setDetail(result.detail ?? null);
    setFeedback({
      kind: "error",
      message: timesheetErrorMessage(result.errorCode, result.httpStatus),
    });
  }, []);

  const run = useCallback((command: WorkDetailCommand, notice: string | null = null) => {
    startTransition(async () => {
      const result = await action(command);
      applyResult(result, notice);
    });
  }, [action, applyResult]);

  const handleCheckpoint = useCallback((kind: CheckpointKind) => {
    startTransition(async () => {
      const capture = await locate();
      const result = await action({ type: "checkpoint", kind, point: capture.point });
      applyResult(result, locationNotice(capture, kind));
    });
  }, [action, applyResult, locate]);

  useEffect(() => {
    const refresh = () => run({ type: "refresh" });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [run]);

  if (!detail) {
    return (
      <div className="work-detail">
        <Feedback feedback={feedback} />
        <section className="work-detail-section">
          <h1>İş ayrıntısı artık gösterilemiyor</h1>
          <p className="muted">Atamalarını yeniden kontrol ederek güncel duruma ulaşabilirsin.</p>
          <Link className="button button-secondary button-small" href="/panel/islerim">
            İşlerime dön
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="work-detail" aria-busy={isPending}>
      <Feedback feedback={feedback} />
      <WorkSummary detail={detail} />
      <div className="work-detail-grid">
        <WorkSessions
          key={`${activeSessionId ?? "closed"}-${detail.observedAt}`}
          detail={detail}
          initialNow={detail.observedAt}
          pending={isPending}
          onCheckpoint={handleCheckpoint}
        />
        <WorkTimeline detail={detail} />
      </div>
      <WorkSecondaryActions detail={detail} pending={isPending} onCommand={run} />
    </div>
  );
}

function Feedback({
  feedback,
}: {
  feedback: { kind: "error" | "notice"; message: string } | null;
}) {
  if (!feedback) return null;
  return (
    <p
      className={feedback.kind === "error" ? "form-warning" : "work-location-notice"}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}
