import type { Metadata } from "next";

import { SessionDetailPage, type SessionDetailPageProps } from "../../../oturum-page";
import { ShellGate } from "../../../shell";

export const metadata: Metadata = {
  title: "Oturum ayrıntısı",
  robots: { index: false, follow: false },
};

export default function Page({ params }: SessionDetailPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/hesap">
      <SessionDetailPage shell="employer" params={params} />
    </ShellGate>
  );
}
