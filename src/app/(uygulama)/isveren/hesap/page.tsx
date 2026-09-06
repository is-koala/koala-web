import type { Metadata } from "next";

import { AccountPage } from "../../hesap-page";
import { ShellGate } from "../../shell";

export const metadata: Metadata = {
  title: "Hesap ve ayarlar",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ShellGate shell="employer" href="/isveren/hesap">
      <AccountPage />
    </ShellGate>
  );
}
