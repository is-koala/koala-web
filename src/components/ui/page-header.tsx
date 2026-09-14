import type { ReactNode } from "react";

/**
 * Sayfa başlığı: üst etiket, `h1`, giriş cümlesi ve sağda eylemler.
 *
 * Kabuk altındaki her sayfa aynı üçlüyü yazıyordu (`eyebrow` / `h1` /
 * `lede`); tek bileşen olunca başlık ile eylem düğmelerinin hizası her
 * sayfada aynı kalıyor ve dar ekranda aynı yerde alt alta düşüyor.
 */
export function PageHeader({
  eyebrow,
  title,
  titleId,
  lede,
  actions,
  as: Heading = "h1",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  titleId?: string;
  lede?: ReactNode;
  /** Başlığın sağındaki düğmeler; dar ekranda altına iner. */
  actions?: ReactNode;
  /** Kart içi başlıklar için `h2`. */
  as?: "h1" | "h2";
  /** Başlığın altında, girişten sonra duran serbest içerik (rozet, sayaç). */
  children?: ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading id={titleId}>{title}</Heading>
        {lede ? <p className="lede">{lede}</p> : null}
        {children}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </header>
  );
}

/**
 * Kart ya da bölüm başlığı (`h2`/`h3`) ve yanındaki eylem.
 */
export function SectionHeader({
  title,
  titleId,
  description,
  actions,
  as: Heading = "h2",
}: {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="ui-section-header">
      <div>
        <Heading id={titleId}>{title}</Heading>
        {description ? <p className="ui-section-description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-actions">{actions}</div> : null}
    </div>
  );
}
