import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/**
 * Kartın zemini. Tasarım sistemi içerikte gölge tanımıyor: kart ya beyaz
 * üstüne hairline, ya gri-100 dolgu, ya da anlamı olan bir yıkama rengi.
 * Yıkamalar durum token'larından geliyor (`--warning-wash` "Ödeme
 * Bekleniyor", `--pending-wash` başvuru, `--success-wash` tamamlanan).
 */
export type CardTone = "white" | "sunken" | "brand" | "success" | "warning" | "pending" | "danger";

type CardOwnProps<T extends ElementType> = {
  as?: T;
  tone?: CardTone;
  /** Sıkı iç boşluk; liste satırı gibi küçük kartlar için. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

export type CardProps<T extends ElementType = "div"> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

/**
 * Yuvarlak köşeli, gölgesiz içerik kartı.
 *
 * Etiket çağıranın kararı: `article` liste üyesi, `section` adlandırılmış
 * bölge, `div` yalnız görsel gruplama. Sunum bileşeni; durum okumaz.
 */
export function Card<T extends ElementType = "div">({
  as,
  tone = "white",
  compact = false,
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const classes = ["ui-card", `ui-card-${tone}`, compact ? "ui-card-compact" : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Sayfanın ana paneli: kabuk içindeki beyaz büyük kart.
 *
 * `app-panel` sınıfı korunuyor; kabuk altındaki bileşenlerin bir kısmı bu
 * sınıfı doğrudan yazıyor ve iki farklı panel görünümü olmamalı.
 */
export function PagePanel({
  as,
  className,
  children,
  ...rest
}: {
  as?: "section" | "div" | "article";
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "className" | "children">) {
  const Tag = as ?? "section";
  return (
    <Tag className={["app-panel", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
}
