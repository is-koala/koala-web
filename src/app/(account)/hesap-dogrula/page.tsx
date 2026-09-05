import type { Metadata } from "next";

import { AccountHandoff } from "@/components/account-handoff";
import { accountContent } from "@/content/account";

export const metadata: Metadata = { title: "Hesabını Doğrula", robots: { index: false, follow: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const content = accountContent["hesap-dogrula"];
  return <AccountHandoff {...content} tokenValue={token} />;
}
