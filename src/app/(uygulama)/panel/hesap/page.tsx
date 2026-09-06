import type { Metadata } from "next";

import { AccountPage, type AccountPageProps } from "../../hesap-page";
import { ShellGate } from "../../shell";

export const metadata: Metadata = {
  title: "Hesap ve ayarlar",
  robots: { index: false, follow: false },
};

export default function Page({ searchParams }: AccountPageProps = {}) {
  return (
    <ShellGate shell="worker" href="/panel/hesap">
      <AccountPage searchParams={searchParams} />
    </ShellGate>
  );
}
