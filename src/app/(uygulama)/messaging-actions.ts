"use server";

import { unstable_rethrow } from "next/navigation";

import type {
  LoadConversationSummaryResult,
  LoadMessagesResult,
  MessagingActionFailure,
  SendMessageResult,
} from "@/messaging/contract";
import { failureView } from "@/server/form";
import {
  getConversation,
  getConversationMessages,
  getConversations,
  getUnreadState,
  getUserPresence,
  markConversationRead,
  sendConversationMessage,
} from "@/server/messaging/messaging";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import { currentViewer } from "@/server/session/viewer";
import { unexpectedError } from "@/server/contract";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validationFailure: MessagingActionFailure = {
  ok: false,
  errorCode: "VALIDATION_FAILED",
  status: 400,
  blocked: false,
};

export async function loadConversationsAction(page: number) {
  await requireSessionForCurrentPath();
  if (!Number.isSafeInteger(page) || page < 0) return validationFailure;
  const { viewer } = await currentViewer();
  if (viewer === null) return { ...validationFailure, errorCode: unexpectedError, status: 500 };
  try {
    return { ok: true as const, page: await getConversations(viewer.id, page) };
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
): Promise<LoadConversationSummaryResult> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(conversationId)) return validationFailure;
  const { viewer } = await currentViewer();
  if (viewer === null) return { ...validationFailure, errorCode: unexpectedError, status: 0 };
  try {
    const conversation = await getConversation(viewer.id, conversationId);
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

function actionFailure(error: unknown): MessagingActionFailure {
  const { errorCode, httpStatus } = failureView(error);
  return {
    ok: false,
    errorCode,
    status: httpStatus,
    blocked: httpStatus === 403,
  };
}
