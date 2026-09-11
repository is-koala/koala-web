import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IdentityDocumentForm } from "@/components/identity/document-form";
import { identityHandoffContent } from "@/content/account";
import { identityVerificationPath } from "@/identity/handoff";
import { safeInternalPath } from "@/lib/urls";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Kimlik Doğrulama",
  robots: { index: false, follow: false },
};

/**
 * Kimlik kapısının web ekranı.
 *
 * Çip PA tarayıcıda üretilmez; beş alanlık form da damgalamaz. Ürün yolu
 * TCKK ön/arka fotoğrafı + personel onayı (koala-backend#193). `next` güvenliyse
 * dönüş yolunu taşır.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { viewer } = await enterShell();
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeInternalPath(next) : null;
  const destination =
    nextPath && nextPath !== identityVerificationPath ? nextPath : "/";

  if (viewer?.identityVerified) redirect(destination);

  return (
    <section className="account-card">
      <p className="eyebrow">{identityHandoffContent.eyebrow}</p>
      <h1>{identityHandoffContent.title}</h1>
      <p className="lede">{identityHandoffContent.body}</p>
      <IdentityDocumentForm
        firstName={viewer?.firstName ?? ""}
        lastName={viewer?.lastName ?? ""}
      />
      {nextPath && nextPath !== identityVerificationPath ? (
        <p>
          <Link className="text-link" href={nextPath}>
            {identityHandoffContent.continueLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
