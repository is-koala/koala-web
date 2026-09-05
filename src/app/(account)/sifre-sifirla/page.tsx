import type { Metadata } from "next";
import { headers } from "next/headers";
import { OpenInApp } from "@/components/open-in-app";
import { appHostForRoute, deepLink, detectPlatform, storeLink } from "@/lib/platform";

export const metadata: Metadata = { title: "Şifreni Sıfırla" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const platform = detectPlatform((await headers()).get("user-agent"));
  const host = appHostForRoute["sifre-sifirla"];

  if (!token) {
    return (
      <p className="text-neutral-600">
        Bu bağlantı geçersiz görünüyor. Lütfen e-postandaki bağlantıya yeniden tıkla.
      </p>
    );
  }

  if (platform !== "desktop" && host) {
    return (
      <OpenInApp
        deepLink={deepLink(host, token)}
        storeLink={storeLink(platform)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Şifreni Sıfırla</h1>
      {/* TODO(#1 Faz 0): masaüstü akışı. */}
      <p className="text-neutral-600">Bu akış hazırlanıyor.</p>
    </div>
  );
}
