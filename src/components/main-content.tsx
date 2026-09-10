import type { ReactNode } from "react";

import { mainContentId } from "@/lib/landmarks";

export function MainContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <main id={mainContentId} className={className} tabIndex={-1}>
      {children}
    </main>
  );
}
