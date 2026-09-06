"use client";

import { useEffect, useState } from "react";

import type { CheckpointKind, WorkDetail } from "@/assignments/work-detail";

import {
  canCheckIn,
  formatDateTime,
  formatDuration,
  formatElapsed,
  openSession,
  totalMinutes,
} from "./presenters";

export function WorkSessions({
  detail,
  initialNow,
  pending,
  onCheckpoint,
}: {
  detail: WorkDetail;
  initialNow: number;
  pending: boolean;
  onCheckpoint: (kind: CheckpointKind) => void;
}) {
  const active = openSession(detail);
  const activeId = active?.id;
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  return (
    <section className="work-detail-section work-session-panel" aria-labelledby="work-session-heading">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Puantaj</p>
          <h2 id="work-session-heading">Çalışma oturumu</h2>
        </div>
        <strong className="work-total">Toplam {formatDuration(totalMinutes(detail.sessions))}</strong>
      </div>

      {active ? (
        <div className="open-session">
          <span>Açık oturum</span>
          <strong role="timer" aria-label="Geçen süre">
            {formatElapsed(active.checkInAt, now)}
          </strong>
          <small>{formatDateTime(active.checkInAt)} tarihinde başladı</small>
        </div>
      ) : null}

      {active ? (
        <button
          className="button button-primary"
          type="button"
          disabled={pending}
          onClick={() => onCheckpoint("check-out")}
        >
          {pending ? "Kaydediliyor" : "İşten çıkış yap"}
        </button>
      ) : canCheckIn(detail) ? (
        <button
          className="button button-primary"
          type="button"
          disabled={pending}
          onClick={() => onCheckpoint("check-in")}
        >
          {pending ? "Kaydediliyor" : "İşe giriş yap"}
        </button>
      ) : detail.assignment.status === "CONFIRMED" &&
        detail.assignment.paymentStatus === "PENDING_COLLECTION" ? (
        <p className="assignment-notice">İşe giriş için işveren ödemesinin güvenceye alınması bekleniyor.</p>
      ) : null}

      <div className="work-session-history">
        <h3>Oturum geçmişi</h3>
        {detail.sessions.length === 0 ? (
          <p className="muted">Henüz çalışma oturumu yok.</p>
        ) : (
          <ul>
            {[...detail.sessions].reverse().map((session) => (
              <li key={session.id}>
                <span>{formatDateTime(session.checkInAt)}</span>
                <strong>{session.checkOutAt ? formatDuration(session.minutes ?? 0) : "Devam ediyor"}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
