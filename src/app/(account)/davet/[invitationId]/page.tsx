import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { InvitationPageView } from "@/components/company/invitation-page";
import { InvalidLinkCard } from "@/components/invalid-link-card";
import { ErrorState, LoadingState } from "@/components/states";
import { isUuid } from "@/lib/identifiers";
import type { CompanyContactInvitation } from "@/lib/invitations";
import { getInvitation } from "@/server/company/invitations";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { answerInvitationAction } from "./actions";

export const metadata: Metadata = {
  title: "Şirket daveti",
  robots: { index: false, follow: false },
};

/**
 * Şirket yetkilisi davetinin karşılama sayfası.
 *
 * Kabuk altında değil `(account)` altında: kullanıcı buraya e-postadan gelip
 * tek bir işi bitiriyor ve karar verene kadar hiçbir şirketin yetkilisi
 * değil, yani `/isveren` kabuğunda gösterilecek bir şeyi de yok.
 *
 * Oturum kapısı `enterShell()` üzerinden: adı kabuktan geliyor ama yaptığı
 * iş tam olarak burada gereken sıra — önce `requireSessionForCurrentPath()`,
 * sonra `React.cache()` ile paylaşılan `GET /users/me`. Oturumsuz ziyaretçi
 * `/giris?next=/davet/{id}` adresine düşüyor ve giriş sonrası buraya
 * dönüyor; bu dilim yeni bir dönüş mekanizması yazmıyor.
 *
 * Profil **zorunlu**, süs değil: sahiplik kararı oturum sahibinin kimliğine
 * bakıyor ve `GET /contact-invitations/{invitationId}` bu denetimi hiç
 * yapmıyor.
 */
export default async function Page({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const { viewer, failure } = await enterShell();

  /*
   * Biçimi bozuk kimlik backend'e hiç sorulmuyor: kullanıcının yapabileceği
   * tek şey e-postadaki bağlantıyı yeniden açmak ve gereksiz bir çağrı hız
   * kovasından hak yakardı.
   *
   * Denetim oturum kapısından **sonra**: bozuk bir kimlikle gelen oturumsuz
   * ziyaretçiye de önce giriş gösteriliyor, yoksa hangi davet kimliklerinin
   * geçerli biçimde olduğu oturum açmadan sorgulanabilirdi.
   */
  if (!isUuid(invitationId)) return <InvalidLinkCard />;

  // Profil çözülemezse sahiplik kararı verilemez; aksiyonları "kimin olduğu
  // bilinmeyen" bir davete açmak, kullanıcıyı kesin bir 403'e sürerdi.
  if (viewer === null) {
    return <ErrorState errorCode={failure?.errorCode} status={failure?.status ?? 0} />;
  }

  return (
    <Suspense fallback={<LoadingState label="Davet yükleniyor…" />}>
      <InvitationPanel invitationId={invitationId} viewerId={viewer.id} />
    </Suspense>
  );
}

export async function InvitationPanel({
  invitationId,
  viewerId,
}: {
  invitationId: string;
  viewerId: string;
}) {
  let invitation: CompanyContactInvitation;
  try {
    invitation = await getInvitation(invitationId);
  } catch (error) {
    unstable_rethrow(error);
    // 404 `COMPANY_CONTACT_INVITATION_NOT_FOUND` de buraya düşüyor: metni
    // `errorPresentation` seçiyor ve backend'in ham mesajı ekrana basılmıyor.
    const { errorCode, httpStatus } = failureView(error);
    return <ErrorState errorCode={errorCode} status={httpStatus} />;
  }

  return (
    <InvitationPageView
      invitation={invitation}
      viewerId={viewerId}
      action={answerInvitationAction.bind(null, invitationId)}
    />
  );
}
