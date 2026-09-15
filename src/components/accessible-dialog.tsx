"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from "react";

/**
 * Odak tuzağı olan kipli diyalog kabuğu.
 *
 * Mesaj dizisinden (`messaging/conversation-thread.tsx`) çıkarıldı: kimlik
 * görüntüleme onayı da (is-koala/koala-web#185) aynı üç şeyi istiyor — açılınca
 * ilk odaklanabilir öğeye odak, Tab'ın diyalog içinde dönmesi, Escape ile
 * kapanma ve kapanınca odağın açan düğmeye dönmesi. `AssignmentDialog` bunları
 * yapmıyor; o bir form kabuğu.
 *
 * `dismissDisabled` bir istek uçuştayken Escape'i kapatıyor: diyalog gidip
 * yanıt geldiğinde kullanıcı onu nereye koyacağını bilemezdi.
 */
export function AccessibleDialog({
  labelledBy,
  dismissDisabled,
  returnFocus,
  onDismiss,
  children,
}: {
  labelledBy: string;
  dismissDisabled: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnFocusElement = returnFocus.current;
    focusableElements(dialogRef.current)[0]?.focus();
    return () => {
      queueMicrotask(() => {
        if (returnFocusElement?.isConnected) returnFocusElement.focus();
      });
    };
  }, [returnFocus]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !dismissDisabled) {
      event.preventDefault();
      onDismiss();
      return;
    }
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
    <div
      ref={dialogRef}
      className="assignment-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) return [];
  return [...container.querySelectorAll<HTMLElement>(
    "a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )];
}
