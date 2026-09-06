import type { WorkDetail } from "@/assignments/work-detail";

import { formatDateTime } from "./presenters";

type TimelineEvent = { key: string; label: string; at: string | null };

export function WorkTimeline({ detail }: { detail: WorkDetail }) {
  const events: TimelineEvent[] = [];
  if (detail.assignment.assignedAt) {
    events.push({ key: "assigned", label: "Atama oluşturuldu", at: detail.assignment.assignedAt });
  }
  for (const session of detail.sessions) {
    events.push({ key: `${session.id}-in`, label: "İşe giriş yapıldı", at: session.checkInAt });
    if (session.checkOutAt) {
      events.push({ key: `${session.id}-out`, label: "İşten çıkış yapıldı", at: session.checkOutAt });
    }
  }
  if (detail.assignment.completedAt) {
    events.push({ key: "completed", label: "İş tamamlandı", at: detail.assignment.completedAt });
  } else if (detail.assignment.status === "CANCELLED") {
    events.push({ key: "cancelled", label: "Atama iptal edildi", at: null });
  } else if (detail.assignment.status === "REJECTED") {
    events.push({ key: "rejected", label: "Atama reddedildi", at: null });
  }

  events.sort((left, right) => {
    if (!left.at) return 1;
    if (!right.at) return -1;
    return Date.parse(left.at) - Date.parse(right.at);
  });

  return (
    <section className="work-detail-section" aria-labelledby="work-timeline-heading">
      <h2 id="work-timeline-heading">Zaman çizelgesi</h2>
      <ol className="work-timeline" aria-label="Atama zaman çizelgesi">
        {events.map((event) => (
          <li key={event.key}>
            <strong>{event.label}</strong>
            {event.at ? <time dateTime={event.at}>{formatDateTime(event.at)}</time> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
