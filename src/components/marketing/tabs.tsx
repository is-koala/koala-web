"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = {
  id: string;
  /** Sekme düğmesinin içeriği; metin ya da ikonlu blok. */
  label: ReactNode;
  panel: ReactNode;
};

/**
 * Sunucuda hazırlanmış panelleri sekmeyle değiştiren küçük istemci parçası.
 *
 * Paneller `ReactNode` olarak geliyor: içerikleri sunucu bileşenleri çiziyor,
 * burada yalnız hangisinin görüneceği tutuluyor. Betiksiz ilk sekme görünür.
 * Klavye: sol/sağ ok ve Home/End sekmeler arasında dolaşır (WAI-ARIA tabs).
 */
export function Tabs({
  items,
  label,
  variant,
  initial,
}: {
  items: readonly TabItem[];
  label: string;
  variant: "list" | "segmented";
  initial?: string;
}) {
  const baseId = useId();
  const [active, setActive] = useState(initial ?? items[0]?.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = items.find((item) => item.id === active) ?? items[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === active);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActive(items[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={`mk-tabs mk-tabs-${variant}`}>
      <div className="mk-tablist" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((item, index) => {
          const selected = item.id === current.id;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`mk-tab${selected ? " is-selected" : ""}`}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="mk-tabpanel"
      >
        {current.panel}
      </div>
    </div>
  );
}
