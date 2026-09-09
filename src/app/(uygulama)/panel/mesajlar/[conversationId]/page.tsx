import type { Metadata } from "next";

import { MessageThreadPage } from "../../../messages-page";
import { ShellGate } from "../../../shell";

export const metadata: Metadata = { title: "Konuşma" };

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ conversationPage?: string | string[] }>;
}) {
  return (
    <ShellGate shell="worker" href="/panel/mesajlar">
      <MessageThreadPage
        basePath="/panel/mesajlar"
        params={params}
        searchParams={searchParams}
      />
    </ShellGate>
  );
}
