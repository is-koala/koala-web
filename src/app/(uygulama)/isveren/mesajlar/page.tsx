import type { Metadata } from "next";

import { MessagesPage } from "../../messages-page";
import { ShellGate } from "../../shell";

export const metadata: Metadata = { title: "Mesajlar" };

export default function Page() {
  return (
    <ShellGate shell="employer" href="/isveren/mesajlar">
      <MessagesPage basePath="/isveren/mesajlar" />
    </ShellGate>
  );
}
