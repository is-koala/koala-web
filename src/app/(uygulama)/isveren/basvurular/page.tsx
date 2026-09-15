import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { parseInboxQuery } from "@/applications/inbox";
import { ApplicationInbox } from "@/components/application-inbox";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { employerApplicationsPath } from "@/lib/app-routes";
import { readReceivedApplications } from "@/server/applications/inbox";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Başvurular",
  robots: { index: false, follow: false },
};

type InboxPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * İlanlar arası başvuru gelen kutusu.
 *
 * Başvurular artık yalnız ilanın altında değil: `GET /users/me/received-applications`
 * yetkili şirket ve açılan bireysel ilan kapsamını tek sayfada veriyor
 * (is-koala/koala-web#147). Karar hâlâ ilanın inceleme ekranında; bu sayfa
 * süzüp oraya götürür.
 *
 * Yükleniyor durumu bölümün kendi loading dosyasında: kalıcı yokluk için
 * 404 üretilmez. Geçersiz kimlik süzgeci backend'e hiç gitmez, kapsam dışı
 * UUID boş sayfa döner.
 */
export default function Page({ searchParams }: InboxPageProps) {
  return (
    <ShellGate shell="employer" href={employerApplicationsPath}>
      <EmployerInboxPage searchParams={searchParams} />
    </ShellGate>
  );
}

export async function EmployerInboxPage({ searchParams }: InboxPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const query = parseInboxQuery(await searchParams);
  const result = await readReceivedApplications(query)
    .then((page) => ({ page }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <PagePanel className="applications-page">
      <PageHeader
        eyebrow="İşveren paneli"
        title="Başvurular"
        lede="Yetkilisi olduğun şirketlerin ve açtığın bireysel ilanların başvuruları burada. Yeni bekleyenler önce gelir; bir başvuruyu incelemek için ilanın ekranına geç."
      />
      <ApplicationInbox
        page={result.page}
        query={query}
        companies={context.viewer.companies}
      />
    </PagePanel>
  );
}
