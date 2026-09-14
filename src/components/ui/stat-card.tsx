import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

/**
 * Vurgu rengi. İşveren paneli tasarım sisteminde iki yardımcı vurgu taşıyor
 * (`--biz-blue`, `--biz-amber`); yeşil marka, mor başvuru (`--pending`).
 */
export type StatAccent = "green" | "blue" | "amber" | "purple";

/**
 * Özet kartı: büyük sayı, kısa etiket, isteğe bağlı açıklama ve bağlantı.
 *
 * Sayı `null` ise kart "—" çizer ve `hint` nedenini yazar; kartı gizlemek
 * kullanıcıya o ölçünün hiç olmadığını söylerdi.
 */
export function StatCard({
  label,
  value,
  hint,
  accent = "green",
  icon,
  href,
}: {
  label: string;
  value: number | string | null;
  hint?: ReactNode;
  accent?: StatAccent;
  icon: IconName;
  /** Kartın açtığı liste; verilirse kartın tamamı bağlantı olur. */
  href?: string;
}) {
  const body = (
    <>
      <span className={`ui-stat-icon ui-stat-icon-${accent}`} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span className="ui-stat-value">{value === null ? "—" : value}</span>
      <span className="ui-stat-label">{label}</span>
      {hint ? <span className="ui-stat-hint">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className={`ui-stat ui-stat-${accent} ui-stat-link`} href={href}>
        {body}
      </Link>
    );
  }
  return <div className={`ui-stat ui-stat-${accent}`}>{body}</div>;
}
