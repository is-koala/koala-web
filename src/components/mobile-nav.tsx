"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { companyNav, marketingNav } from "@/lib/site";

const mobileNavItems = [...marketingNav, ...companyNav];

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) return [];
  return [
    ...container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ];
}

/**
 * Dar ekranda gizlenen pazarlama bağlantılarının erişim yüzeyi.
 *
 * Masaüstü `.nav-links` 820px altında `display: none` oluyor ve yerine bir
 * denetim yoktu; telefon ziyaretçisi İş İlanları'ndan SSS'ye kadar her
 * başlık maddesini kaybediyordu (is-koala/koala-web#146). Panel kapalı
 * başlar; İletişim ve Hakkımızda da burada durur çünkü ürün menüsünde yer
 * bulamamışlardı.
 */
export function MobileNav() {
  const panelId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnFocus = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusableElements(dialogRef.current)[0]?.focus();
    const blocked = [document.querySelector("main"), document.querySelector(".site-footer")].filter(
      (element): element is Element => element !== null,
    );
    for (const element of blocked) {
      element.setAttribute("inert", "");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const element of blocked) {
        element.removeAttribute("inert");
      }
      queueMicrotask(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
      });
    };
  }, [open]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(event.currentTarget);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="button button-secondary button-small mobile-nav-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        {/* Simge satır içi: tanıtımın ikon haritası sunucuda kalsın, her
            sayfanın istemci paketine girmesin. Dar telefonda yalnız simge
            sığıyor; ad ekran okuyucuya metinden gider. */}
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="mobile-nav-toggle-text">Menüyü aç</span>
      </button>
      {/*
        Panel belge gövdesine çıkar: başlıktaki `backdrop-filter` sabit
        konumlu katmanı başlık kutusuna hapsederdi ve arka plan hâlâ
        tıklanır kalırdı.
      */}
      {open
        ? createPortal(
            <div
              ref={dialogRef}
              id={panelId}
              className="mobile-nav-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={handleKeyDown}
              onClick={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div className="mobile-nav-panel">
                <h2 id={titleId}>Menü</h2>
                <ul className="mobile-nav-links">
                  {mobileNavItems.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Kapat
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
