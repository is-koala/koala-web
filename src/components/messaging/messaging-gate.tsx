import Link from "next/link";
import type { ReactNode } from "react";

import type { MessagingAvailability } from "@/messaging/contract";

export type MessagingParty = "employer" | "worker";

/**
 * Atama ekranlarındaki mesaj düğmesinin kapısı.
 *
 * Karar sunucudan geliyor (`messagingAvailableReason`); burada yalnız üç
 * hâlin metni ve işverenin ödeme yolu var. Karar **yoksa** hiçbir şey
 * çizilmiyor: eski bir önbellekten ya da alanı taşımayan bir uçtan gelen
 * atama için "ödeme gerekli" demek yanlış bir sebep söylemek olurdu, düğmeyi
 * göstermek ise kullanıcıyı 403'e yollamak.
 *
 * Kapalı hâl gizlenmiyor, anlatılıyor — kabuk kapılarının `blocking` kipiyle
 * aynı (`AGENTS.md`). Ödeme dalında yalnız işveren bir yere gidebiliyor;
 * çalışan bekliyor ve metin bunu söylüyor.
 */
export function MessagingGate({
  availability,
  party,
  assignmentId,
  children,
}: {
  availability: MessagingAvailability | null;
  party: MessagingParty;
  /** İşverenin "Ödemeyi tamamla" bağlantısının hedefi; çalışanda okunmuyor. */
  assignmentId: string;
  /** Kapı açıkken çizilen mesaj düğmesi ya da bağlantısı. */
  children: ReactNode;
}) {
  if (availability === null) return null;
  if (availability.available) return <>{children}</>;

  if (availability.reason === "PAYMENT_REQUIRED") {
    return (
      <div className="messaging-gate" role="status" data-messaging-reason="PAYMENT_REQUIRED">
        <p className="muted">{paymentRequiredNotice[party]}</p>
        {party === "employer" ? (
          <Link
            className="button button-secondary button-small"
            href={`/isveren/atama/${encodeURIComponent(assignmentId)}/odeme`}
          >
            Ödemeyi tamamla
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="messaging-gate" role="status" data-messaging-reason="CLOSED">
      <p className="muted">{closedNotice}</p>
    </div>
  );
}

/**
 * `MESSAGING_PAYMENT_REQUIRED` ile aynı cümle (`src/lib/errors.ts`): kapı
 * önden gösterirken de, bayatlayıp 403 yerken de kullanıcı aynı şeyi okur.
 */
const paymentRequiredNotice: Readonly<Record<MessagingParty, string>> = {
  employer:
    "Mesajlaşma, işveren ödemeyi tamamladığında açılır. Ödemeyi tamamladığında bu ilanın grup sohbeti kurulur ve çalışan ona eklenir.",
  worker:
    "Mesajlaşma, işveren ödemeyi tamamladığında açılır. Ödeme emanete düştüğünde bu ilanın grup sohbetine eklenirsin.",
};

const closedNotice =
  "Sohbet kapandı. Atama iptal ya da iade edilmiş veya iş bitiminin üzerinden yedi gün geçmiş olabilir; geçmişi Mesajlar sayfasından okuyabilirsin.";
