import { notFound, unstable_rethrow } from "next/navigation";

import { ConversationList } from "@/components/messaging/conversation-list";
import { ConversationThread } from "@/components/messaging/conversation-thread";
import { ErrorState } from "@/components/states";
import type { ConversationSummary } from "@/messaging/contract";
import { isNotFound } from "@/server/api/errors";
import { failureView } from "@/server/form";
import {
  getConversation,
  getConversationMessages,
  getConversations,
} from "@/server/messaging/messaging";
import { enterShell } from "@/server/session/viewer";

export async function MessagesPage({ basePath }: { basePath: string }) {
  const { viewer } = await enterShell();
  if (!viewer) return null;
  const result = await loadConversationPage(viewer.id);
  if (!result.ok) {
    const failure = result.failure;
    return <ErrorState status={failure.httpStatus} errorCode={failure.errorCode} />;
  }
  return <ConversationList initialPage={result.page} viewerId={viewer.id} basePath={basePath} />;
}

export async function MessageThreadPage({
  basePath,
  params,
}: {
  basePath: string;
  params: Promise<{ conversationId: string }>;
}) {
  const { viewer } = await enterShell();
  if (!viewer) return null;
  const { conversationId } = await params;

  const [messagesResult, conversationResult] = await Promise.allSettled([
    getConversationMessages(conversationId),
    getConversation(viewer.id, conversationId),
  ]);
  if (messagesResult.status === "rejected") {
    unstable_rethrow(messagesResult.reason);
    if (isNotFound(messagesResult.reason)) notFound();
    const failure = failureView(messagesResult.reason);
    return <ErrorState status={failure.httpStatus} errorCode={failure.errorCode} />;
  }
  if (conversationResult.status === "rejected") unstable_rethrow(conversationResult.reason);

  const conversation = conversationResult.status === "fulfilled"
    ? conversationResult.value
    : null;
  return (
    <ConversationThread
      conversation={conversation ?? fallbackConversation(conversationId)}
      initialMessages={messagesResult.value}
      viewerId={viewer.id}
      basePath={basePath}
    />
  );
}

function fallbackConversation(id: string): ConversationSummary {
  return {
    id,
    jobId: null,
    jobTitle: null,
    displayName: "Konuşma",
    profilePictureUrl: null,
    counterpartId: null,
    lastMessageAt: null,
    lastMessageBody: null,
    unreadCount: 0,
    closed: false,
    online: null,
  };
}

async function loadConversationPage(viewerId: string) {
  try {
    return { ok: true as const, page: await getConversations(viewerId) };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, failure: failureView(error) };
  }
}
