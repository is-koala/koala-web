import type { ReactNode } from "react";

/**
 * Liste satırı: solda görsel/avatar, ortada başlık ve alt bilgi, sağda
 * eylem ya da rozet. Tablo yerine satır: kabuk verileri değişken uzunlukta
 * ve dar ekranda sütunlar alt alta düşmeli.
 */
export function ListRow({
  as: Tag = "li",
  leading,
  title,
  meta,
  trailing,
  children,
  className,
  ...rest
}: {
  as?: "li" | "div" | "article";
  leading?: ReactNode;
  title: ReactNode;
  /** Başlığın altındaki ikincil satır(lar). */
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Satırın altına yayılan ek içerik (not, uyarı). */
  children?: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={["ui-row", className].filter(Boolean).join(" ")} {...rest}>
      <div className="ui-row-main">
        {leading ? <div className="ui-row-leading">{leading}</div> : null}
        <div className="ui-row-copy">
          <div className="ui-row-title">{title}</div>
          {meta ? <div className="ui-row-meta">{meta}</div> : null}
        </div>
        {trailing ? <div className="ui-row-trailing">{trailing}</div> : null}
      </div>
      {children ? <div className="ui-row-body">{children}</div> : null}
    </Tag>
  );
}

/** Kenarlıksız satır listesi; satırlar arası hairline. */
export function ListRows({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul className={["ui-rows", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </ul>
  );
}

export type Fact = { term: string; detail: ReactNode };

/**
 * Etiket/değer çiftleri. `dl` kalıyor: ekran okuyucu terimi ve değeri
 * birlikte okuyor. `null` değerli çift çizilmiyor, çağıran boş satırı
 * süzmek zorunda kalmıyor.
 */
export function FactList({
  facts,
  columns = "auto",
  className,
}: {
  facts: ReadonlyArray<Fact | null | false | undefined>;
  /** `auto` sığdığı kadar sütun; `inline` yan yana akan çipler. */
  columns?: "auto" | "inline" | 2 | 3 | 4;
  className?: string;
}) {
  const items = facts.filter((fact): fact is Fact => Boolean(fact));
  if (items.length === 0) return null;
  return (
    <dl
      className={["ui-facts", `ui-facts-${columns}`, className].filter(Boolean).join(" ")}
    >
      {items.map((fact) => (
        <div key={fact.term}>
          <dt>{fact.term}</dt>
          <dd>{fact.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Baş harfli avatar; fotoğraf varsa onu, yoksa adın ilk harfini çizer.
 * Fotoğraf `<img>`: adres backend'in depolama kökeninden geliyor ve
 * `remotePatterns`'te yok (#35).
 */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`ui-avatar ui-avatar-${size}`} src={src} alt="" width={48} height={48} />
    );
  }
  return (
    <span className={`ui-avatar ui-avatar-${size} ui-avatar-initial`} aria-hidden="true">
      {initial}
    </span>
  );
}
