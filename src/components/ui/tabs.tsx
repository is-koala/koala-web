import Link from "next/link";
import type { ReactNode } from "react";

export type LinkTab = {
  href: string;
  label: ReactNode;
  current: boolean;
  /** Sekmenin yanındaki sayaç; sıfır da yazılır. */
  count?: number;
};

/**
 * Adres çubuğuna yazan sekmeler.
 *
 * Süzgeç ve sıralama bağlantı: paylaşılan bir adres aynı görünümü açar ve
 * geri düğmesi çalışır. Görsel olarak sekme ama anlamsal olarak bir gezinme
 * (`nav` + `aria-current="page"`); WAI-ARIA `tablist` istemci durumu ister
 * ve bu sekmelerin durumu adreste.
 */
export function LinkTabs({
  label,
  items,
  variant = "chips",
  className,
}: {
  label: string;
  items: readonly LinkTab[];
  /** `chips` yuvarlak çipler; `segmented` tek kapsül içinde bölmeler. */
  variant?: "chips" | "segmented";
  className?: string;
}) {
  return (
    <nav
      className={["ui-tabs", `ui-tabs-${variant}`, className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          className="ui-tab"
          href={item.href}
          aria-current={item.current ? "page" : undefined}
        >
          {item.label}
          {item.count === undefined ? null : <span className="ui-tab-count">{item.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
