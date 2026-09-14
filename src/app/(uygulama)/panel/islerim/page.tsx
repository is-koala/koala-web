import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { AssignmentList } from "@/components/assignment-list";
import { EmptyState, ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { readWorkerAssignments } from "@/server/assignments/assignments";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { readAssignmentAcceptanceAction, respondAssignmentAction } from "./actions";

export default async function Page() {
  return (
    <ShellGate shell="worker" href="/panel/islerim">
      <AssignmentsPage />
    </ShellGate>
  );
}

export async function AssignmentsPage() {
  const context = await enterShell();
  // Profil hatasını layout zaten tek bir hata kartıyla anlatır. Aynı anda
  // atama isteğine çıkmak, çözülemeyen kullanıcı için ikinci bir hata üretir.
  if (context.failure !== null || context.viewer === null) return null;

  const result = await readWorkerAssignments()
    .then((assignments) => ({ assignments }))
    .catch((error: unknown) => {
      // redirect/notFound gibi Next denetim akışlarını hata kartına yutma.
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return (
      <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />
    );
  }

  const { assignments } = result;

  return (
    <PagePanel className="assignments-page">
      <PageHeader
        eyebrow="Çalışan paneli"
        title="İşlerim"
        lede="Atamalarını gör, onay bekleyen işlere tek yerden yanıt ver."
      />

      {assignments.content.length === 0 ? (
        <EmptyState kind="assignments" />
      ) : (
        <AssignmentList
          initialPage={assignments}
          respondAction={respondAssignmentAction}
          acceptanceAction={readAssignmentAcceptanceAction}
        />
      )}
    </PagePanel>
  );
}
