import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import { WorkDetailScreen } from "@/components/work-detail/work-detail-screen";
import { ErrorState, LoadingState } from "@/components/states";
import { isUuid } from "@/lib/identifiers";
import { readWorkDetail } from "@/server/assignments/work-detail";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { workConversationAction, workDetailAction } from "./actions";

type WorkDetailPageProps = { params: Promise<{ assignmentId: string }> };

export default function Page({ params }: WorkDetailPageProps) {
  return (
    <ShellGate shell="worker" href="/panel/islerim">
      <Suspense fallback={<LoadingState label="İş ayrıntısı yükleniyor" />}>
        <WorkDetailPage params={params} />
      </Suspense>
    </ShellGate>
  );
}

export async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();

  const result = await readWorkDetail(assignmentId)
    .then((detail) => ({ detail }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }
  if (!result.detail) notFound();

  return (
    <WorkDetailScreen
      initialDetail={result.detail}
      action={workDetailAction.bind(null, assignmentId)}
      conversationAction={workConversationAction.bind(null, result.detail.assignment.jobId)}
    />
  );
}
