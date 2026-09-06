import { unstable_rethrow } from "next/navigation";

import { AssignmentList } from "@/components/assignment-list";
import { EmptyState, ErrorState } from "@/components/states";
import { readWorkerAssignments } from "@/server/assignments/assignments";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { respondAssignmentAction } from "./actions";

export default async function Page() {
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
    <section className="app-panel assignments-page">
      <p className="eyebrow">Çalışan paneli</p>
      <h1>İşlerim</h1>
      <p className="lede">Atamalarını gör, onay bekleyen işlere tek yerden yanıt ver.</p>

      {assignments.content.length === 0 ? (
        <EmptyState kind="assignments" />
      ) : (
        <AssignmentList initialPage={assignments} respondAction={respondAssignmentAction} />
      )}
    </section>
  );
}
