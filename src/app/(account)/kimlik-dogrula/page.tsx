import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IdentityDocumentForm } from "@/components/identity/document-form";
import { DoneNotice } from "@/components/form-controls";
import { identityHandoffContent } from "@/content/account";
import { identityVerificationPath } from "@/identity/handoff";
import { safeInternalPath } from "@/lib/urls";
import { getCurrentIdentityReview } from "@/server/identity/documents";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Kimlik Doğrulama",
  robots: { index: false, follow: false },
};

/**
 * Kimlik kapısının web ekranı.
 *
 * Çip PA tarayıcıda üretilmez; beş alanlık form da damgalamaz. Ürün yolu
 * Dört TCKK fotoğrafı + personel onayı (koala-backend#219). `next` güvenliyse
 * dönüş yolunu taşır. Bekleyen inceleme yeniden yüklemeyi kapatır; red
 * gerekçesi aynı formun üstünde durur.
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

  const review = await getCurrentIdentityReview();
  if (review?.status === "APPROVED") redirect(destination);

  return (
    <section className="account-card">
      <p className="eyebrow">{identityHandoffContent.eyebrow}</p>
      <h1>{identityHandoffContent.title}</h1>
      <p className="lede">{identityHandoffContent.body}</p>
      {review?.status === "PENDING" ? (
        <DoneNotice title={identityHandoffContent.pendingTitle}>
          {identityHandoffContent.pendingBody}
        </DoneNotice>
      ) : (
        <>
          {review?.status === "REJECTED" ? (
            <DoneNotice title={identityHandoffContent.rejectedTitle}>
              {identityHandoffContent.rejectedBody}
              {review.rejectionReason ? (
                <p>
                  {identityHandoffContent.rejectionReasonLabel}: {review.rejectionReason}
                </p>
              ) : null}
            </DoneNotice>
          ) : null}
          <IdentityDocumentForm
            firstName={viewer?.firstName ?? ""}
            lastName={viewer?.lastName ?? ""}
          />
        </>
      )}
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
