import type { Metadata } from "next";

import { MessageThreadPage } from "../../../messages-page";
import { ShellGate } from "../../../shell";

export const metadata: Metadata = { title: "Konuşma" };

export default function Page({ params }: { params: Promise<{ conversationId: string }> }) {
  return (
    <ShellGate shell="worker" href="/panel/mesajlar">
      <MessageThreadPage basePath="/panel/mesajlar" params={params} />
    </ShellGate>
  );
}
