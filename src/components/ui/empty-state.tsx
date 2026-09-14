import Image from "next/image";
import type { ReactNode } from "react";

import mascotEmployer from "../../../public/brand/maskot-isveren.webp";
import mascotWorker from "../../../public/brand/maskot-calisan.webp";

export type Mascot = "employer" | "worker";

const mascots = {
  employer: mascotEmployer,
  worker: mascotWorker,
} as const;

/* Görsel 600×900; oran elle: Vitest statik içe aktarımı düz yol olarak
   çözüyor ve `width`/`height` alanları orada yok. */
const mascotRatio = 600 / 900;

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
  const height = 132;
  return (
    <div
      role={role === "none" ? undefined : role}
      className={["ui-empty", mascot ? "ui-empty-with-mascot" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {mascot ? (
        <Image
          className="ui-empty-mascot"
          src={mascots[mascot]}
          alt=""
          height={height}
          width={Math.round(height * mascotRatio)}
          sizes="96px"
        />
      ) : null}
      <div className="ui-empty-copy">
        <h2>{title}</h2>
        {message ? <p>{message}</p> : null}
        {children ? <div className="ui-empty-actions">{children}</div> : null}
      </div>
    </div>
  );
}
