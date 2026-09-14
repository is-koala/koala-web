import type { ReactNode } from "react";

import { MascotImage, type Mascot } from "./mascot";

export type { Mascot } from "./mascot";

/**
 * Boş durum kartı: maskot, başlık, tek cümle ve varsa çıkış eylemi.
 *
 * Maskot işveren ekranlarında `koala_business`, çalışan ekranlarında
 * `koala_worker` (tasarım sistemi: kişiliği maskot taşır, arayüz sessiz
 * kalır). Görsel dekor, `alt` boş; anlam başlıkta. `role="status"`
 * varsayılan: boş liste bir hata değil, sayfanın o anki hâli.
 */
export function EmptyStateCard({
  title,
  message,
  mascot,
  role = "status",
  children,
  className,
}: {
  title: ReactNode;
  message?: ReactNode;
  mascot?: Mascot;
  role?: "status" | "region" | "none";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role === "none" ? undefined : role}
      className={["ui-empty", mascot ? "ui-empty-with-mascot" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {mascot ? <MascotImage className="ui-empty-mascot" mascot={mascot} height={132} /> : null}
      <div className="ui-empty-copy">
        <h2>{title}</h2>
        {message ? <p>{message}</p> : null}
        {children ? <div className="ui-empty-actions">{children}</div> : null}
      </div>
    </div>
  );
}
