"use server";

import { unstable_rethrow } from "next/navigation";

import type {
  LoadConversationSummaryResult,
  LoadMessagesResult,
  MessageReportResult,
  MessagingActionFailure,
  ReportReason,
  SendMessageResult,
} from "@/messaging/contract";
import {
  conversationListPageSize,
  isConversationSourcePage,
  reportReasons,
} from "@/messaging/contract";
import { ApiError } from "@/server/api/errors";
import { unexpectedError } from "@/server/contract";
import { failureView } from "@/server/form";
import {
  blockUser,
  getConversation,
  getConversationMessages,
  getConversations,
  getUnreadState,
  getUserPresence,
  markConversationRead,
  reportContent,
  sendConversationMessage,
  unblockUser,
} from "@/server/messaging/messaging";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import { currentViewer, type ViewerFailure } from "@/server/session/viewer";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validationFailure: MessagingActionFailure = {
  ok: false,
  errorCode: "VALIDATION_FAILED",
  status: 400,
  blocked: false,
};

export async function loadConversationsAction(page: number) {
  await requireSessionForCurrentPath();
  if (!isConversationSourcePage(page)) return validationFailure;
  const { viewer } = await currentViewer();
  if (viewer === null) return { ...validationFailure, errorCode: unexpectedError, status: 500 };
  try {
    return {
      ok: true as const,
      page: await getConversations(viewer.id, page, conversationListPageSize),
    };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function loadUnreadStateAction() {
  await requireSessionForCurrentPath();
  try {
    return { ok: true as const, state: await getUnreadState() };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function loadConversationSummaryAction(
  conversationId: string,
  sourcePage = 0,
): Promise<LoadConversationSummaryResult> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(conversationId) || !isConversationSourcePage(sourcePage)) {
    return validationFailure;
  }
  const { viewer } = await currentViewer();
  if (viewer === null) return { ...validationFailure, errorCode: unexpectedError, status: 0 };
  try {
    const conversation = await getConversation(viewer.id, conversationId, sourcePage);
    return conversation === null
      ? { ...validationFailure, errorCode: unexpectedError, status: 0 }
      : { ok: true, conversation };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function sendMessageAction(
  conversationId: string,
  rawBody: string,
): Promise<SendMessageResult> {
  await requireSessionForCurrentPath();
  const body = rawBody.trim();
  if (!uuidPattern.test(conversationId) || body.length === 0 || body.length > 4_000) {
    return validationFailure;
  }
  try {
    return { ok: true, message: await sendConversationMessage(conversationId, body) };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function loadOlderMessagesAction(
  conversationId: string,
  page: number,
): Promise<LoadMessagesResult> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(conversationId) || !Number.isSafeInteger(page) || page < 0) {
    return validationFailure;
  }
  try {
    return { ok: true, page: await getConversationMessages(conversationId, page) };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

/**
 * Topic aboneliğinin yetki kapısı. Ham backend hatası Server Action sınırını
 * aşmaz; istemci `false` kararını yerel, sabit bir hataya çevirir ve
 * `RealtimeClient` bu durumda SUBSCRIBE üretmez.
 */
export async function confirmConversationAccessAction(conversationId: string): Promise<boolean> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(conversationId)) return false;
  try {
    await getConversationMessages(conversationId, 0, 1);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

export async function confirmPresenceAccessAction(userId: string): Promise<boolean> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(userId)) return false;
  try {
    await getUserPresence(userId);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

export async function markConversationReadAction(conversationId: string): Promise<boolean> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(conversationId)) return false;
  try {
    await markConversationRead(conversationId);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    // Okundu işareti ana mesaj akışını kesmez; sonraki görünürlük veya mesaj
    // olayı güvenli biçimde yeniden deneyecektir.
    return false;
  }
}

export async function blockConversationUserAction(
  conversationId: string,
  sourcePage = 0,
): Promise<{ ok: true } | MessagingActionFailure> {
  await requireSessionForCurrentPath();
  if (
    typeof conversationId !== "string"
    || !uuidPattern.test(conversationId)
    || !isConversationSourcePage(sourcePage)
  ) {
    return validationFailure;
  }
  const counterpartId = await directCounterpart(conversationId, sourcePage);
  if (typeof counterpartId !== "string") return counterpartId;
  try {
    await blockUser(counterpartId);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function unblockConversationUserAction(
  conversationId: string,
  sourcePage = 0,
): Promise<{ ok: true } | MessagingActionFailure> {
  await requireSessionForCurrentPath();
  if (
    typeof conversationId !== "string"
    || !uuidPattern.test(conversationId)
    || !isConversationSourcePage(sourcePage)
  ) {
    return validationFailure;
  }
  const counterpartId = await directCounterpart(conversationId, sourcePage);
  if (typeof counterpartId !== "string") return counterpartId;
  try {
    await unblockUser(counterpartId);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

export async function reportMessageAction(
  conversationId: string,
  messageId: string,
  rawReason: string,
  rawDescription: string,
): Promise<MessageReportResult> {
  await requireSessionForCurrentPath();
  const report = validReport(conversationId, rawReason, rawDescription);
  if (report === null || typeof messageId !== "string" || !uuidPattern.test(messageId)) {
    return validationFailure;
  }
  try {
    const receipt = await reportContent({ messageId }, report.reason, report.description);
    return { ok: true, reportId: receipt.id };
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

async function directCounterpart(
  conversationId: string,
  sourcePage: number,
): Promise<string | MessagingActionFailure> {
  try {
    const { viewer, failure } = await currentViewer();
    if (viewer === null) {
      return viewerActionFailure(failure);
    }
    const conversation = await getConversation(viewer.id, conversationId, sourcePage);
    return conversation?.counterpartId ?? validationFailure;
  } catch (error) {
    unstable_rethrow(error);
    return actionFailure(error);
  }
}

function validReport(
  conversationId: unknown,
  rawReason: unknown,
  rawDescription: unknown,
): { reason: ReportReason; description?: string } | null {
  if (
    typeof conversationId !== "string"
    || typeof rawReason !== "string"
    || typeof rawDescription !== "string"
  ) {
    return null;
  }
  const reason = reportReasons.find((candidate) => candidate === rawReason);
  const description = rawDescription.trim();
  if (!uuidPattern.test(conversationId) || reason === undefined || description.length > 2_000) {
    return null;
  }
  return {
    reason,
    ...(description.length === 0 ? {} : { description }),
  };
}

function actionFailure(error: unknown): MessagingActionFailure {
  const { errorCode, httpStatus } = failureView(error);
  return {
    ok: false,
    errorCode,
    status: httpStatus,
    blocked: httpStatus === 403,
    ...(error instanceof ApiError && error.requestId
      ? { requestId: error.requestId }
      : {}),
  };
}

function viewerActionFailure(failure: ViewerFailure | null): MessagingActionFailure {
  const status = failure?.status ?? 500;
  return {
    ok: false,
    errorCode: failure?.errorCode ?? unexpectedError,
    status,
    blocked: status === 403,
    ...(failure?.requestId ? { requestId: failure.requestId } : {}),
  };
}
