import type { WorkDetail } from "@/assignments/work-detail";
import { formatDateTime } from "@/lib/dates";

type TimelineEvent = { key: string; label: string; at: string | null };

/**
 * Çalışanın atama çizelgesi.
 *
 * Zamanı olmayan adım yalnız iki durumda çiziliyor: iptal kaydı okunamadıysa
 * ("Atama iptal edildi") ve ret ("Atama reddedildi" — backend ret anını
 * taşımıyor). Başvuru, kabul, onay ve ödeme satırları zamanları geldiğinde
 * beliriyor; uydurulmuş bir zaman olmayan bir kaydı varmış gibi gösterirdi.
 */
export function WorkTimeline({ detail }: { detail: WorkDetail }) {
  const { assignment, resolution } = detail;
  const events: TimelineEvent[] = [];
  if (assignment.appliedAt) {
    events.push({ key: "applied", label: "Başvuru yapıldı", at: assignment.appliedAt });
  }
  if (assignment.acceptedAt) {
    events.push({ key: "accepted", label: "Başvurun kabul edildi", at: assignment.acceptedAt });
  }
  if (assignment.assignedAt) {
    events.push({ key: "assigned", label: "Atama oluşturuldu", at: assignment.assignedAt });
  }
  if (assignment.confirmedAt) {
    events.push({ key: "confirmed", label: "Atamayı onayladın", at: assignment.confirmedAt });
  }
  if (assignment.paymentSecuredAt) {
    events.push({ key: "payment-secured", label: "Ödeme emanete alındı", at: assignment.paymentSecuredAt });
  }
  for (const session of detail.sessions) {
    events.push({ key: `${session.id}-in`, label: "İşe giriş yapıldı", at: session.checkInAt });
    if (session.checkOutAt) {
      events.push({ key: `${session.id}-out`, label: "İşten çıkış yapıldı", at: session.checkOutAt });
    }
  }
  if (assignment.completedAt) {
    events.push({ key: "completed", label: "İş tamamlandı", at: assignment.completedAt });
  } else if (assignment.status === "CANCELLED") {
    events.push({
      key: "cancelled",
      label: "Atama iptal edildi",
      at: resolution.cancellation?.cancelledAt ?? null,
    });
  } else if (assignment.status === "REJECTED") {
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
