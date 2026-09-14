import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";

type SectionTone = "white" | "sunken" | "deep" | "dark";

/**
 * Tanıtım sayfalarının ortak bölüm kabuğu.
 *
 * Mockup bölümleri iki zemin arasında gidip geliyor (beyaz / gri-100) ve
 * her biri aynı iç genişlikte duruyor; kabuk bunu tek yerde tutar ki
 * bölümler arasında kenar boşluğu ve zemin kayması olmasın.
 */
export function Section({
  id,
  tone = "white",
  narrow = false,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  tone?: SectionTone;
  /** SSS gibi tek sütunlu bölümler için dar iç genişlik. */
  narrow?: boolean;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const classes = ["mk-section", `mk-section-${tone}`, className].filter(Boolean).join(" ");
  return (
    <section id={id} className={classes} aria-labelledby={labelledBy}>
      <div className={narrow ? "mk-inner mk-inner-narrow" : "mk-inner"}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  as: Heading = "h2",
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mk-heading">
      <p className="mk-eyebrow">{eyebrow}</p>
      <Heading id={id} className="mk-title">
        {title}
      </Heading>
      {intro ? <p className="mk-intro">{intro}</p> : null}
    </div>
  );
}

export type IconTone = "green" | "amber" | "blue" | "yellow" | "purple";

/** Yumuşak renkli kare zemin üstünde ikon; kartlar ve adımlar bunu paylaşır. */
export function IconTile({
  icon,
  tone,
  size = 52,
}: {
  icon: IconName;
  tone: IconTone;
  size?: number;
}) {
  return (
    <span
      className={`mk-icon-tile mk-tone-${tone}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    >
      <Icon name={icon} size={Math.round(size / 2)} />
    </span>
  );
}

/** "Örnek" rozeti: kart gerçek ilan değil, bunu okuyucuya her kartta söyler. */
export function SampleBadge({ label }: { label: string }) {
  return (
    <span className="mk-sample">
      <Icon name="quill" size={13} />
      {label}
    </span>
  );
}
