import type { Metadata } from "next";

import { MessageThreadPage } from "../../../messages-page";
import { ShellGate } from "../../../shell";

export const metadata: Metadata = { title: "Konuşma" };

export default function Page({ params }: { params: Promise<{ conversationId: string }> }) {
  return (
    <ShellGate shell="employer" href="/isveren/mesajlar">
      <MessageThreadPage basePath="/isveren/mesajlar" params={params} />
    </ShellGate>
  );
}
