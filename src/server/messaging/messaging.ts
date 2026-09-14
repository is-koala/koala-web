import "server-only";

import { unstable_rethrow } from "next/navigation";

import type {
  ConversationParticipant,
  ConversationParticipantRole,
  ConversationSummary,
  Message,
  Page,
  ReportReason,
} from "@/messaging/contract";
import {
  conversationListPageSize,
  isConversationSourcePage,
  normalizeSenderName,
} from "@/messaging/contract";
import { apiRequest } from "@/server/session/session";

type BackendUser = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

/**
 * `ConversationParticipantDto` (is-koala/koala-backend#281). Dört alan eski
 * sunucuda yok — o zaman `participants` düz `SafeUserDto` listesi — bu yüzden
 * hepsi isteğe bağlı okunuyor ve yokluk `null`/`false`a düşüyor.
 */
type BackendParticipant = BackendUser & {
  role?: string | null;
  joinedAt?: string | null;
  lastReadAt?: string | null;
  left?: boolean | null;
};

type BackendMessage = Message & { senderName?: string | null };

type BackendConversation = {
  id?: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
  kind?: string | null;
  employer?: BackendUser | null;
  worker?: BackendUser | null;
  participants?: readonly BackendParticipant[] | null;
  lastMessageAt?: string | null;
  lastMessageBody?: string | null;
  unreadCount?: number | null;
  closed?: boolean | null;
};

type BackendPresence = {
  userId?: string | null;
  online?: boolean | null;
};

type BackendUserBlock = {
  blocked?: { id?: string | null } | null;
};

type BackendPage<T> = {
  content?: readonly T[] | null;
  page?: number | null;
  number?: number | null;
  totalPages?: number | null;
  totalElements?: number | null;
  last?: boolean | null;
};

export async function getConversations(
  viewerId: string,
  page = 0,
  size = conversationListPageSize,
): Promise<Page<ConversationSummary>> {
  return getConversationPage(viewerId, page, size, true);
}

async function getConversationPage(
  viewerId: string,
  page: number,
  size: number,
  includePresence: boolean,
): Promise<Page<ConversationSummary>> {
  const response = await apiRequest<BackendPage<BackendConversation>>(
    `/conversations?${new URLSearchParams({ page: String(page), size: String(size) })}`,
    { method: "GET", cache: "no-store" },
  );
  const content = (response.content ?? []).map((item) => ({
    ...toConversation(item, viewerId),
    sourcePage: page,
  }));
  const counterpartIds = [...new Set(content.flatMap((item) =>
    item.counterpartId === null ? [] : [item.counterpartId],
  ))];
  const presence = includePresence ? await getPresenceSafely(counterpartIds) : new Map();

  return pageOf(response, content.map((item) => ({
    ...item,
    online: item.counterpartId === null ? null : (presence.get(item.counterpartId) ?? null),
  })));
}

export async function getConversationMessages(
  conversationId: string,
  page = 0,
  size = 30,
): Promise<Page<Message>> {
  const response = await apiRequest<BackendPage<BackendMessage>>(
    `/conversations/${encodeURIComponent(conversationId)}/messages?${new URLSearchParams({
      page: String(page),
      size: String(size),
    })}`,
    { method: "GET", cache: "no-store" },
  );
  return pageOf(response, [...(response.content ?? [])].reverse().map(toMessage));
}

export async function getConversation(
  viewerId: string,
  conversationId: string,
  sourcePage = 0,
): Promise<ConversationSummary | null> {
  if (!isConversationSourcePage(sourcePage)) return null;
  // Backend tek konuşma özeti sunmuyor. Liste linkindeki sayfa yalnız bir
  // lookup ipucudur: hedef ve katılımcılar yine participant-filtered backend
  // sayfasından çıkarılır; eşleşme yoksa istemci verisine güvenmeden kapanır.
  const hinted = await getConversationPage(
    viewerId,
    sourcePage,
    conversationListPageSize,
    false,
  );
  return hinted.content.find((conversation) => conversation.id === conversationId) ?? null;
}

/**
 * `POST /jobs/{jobId}/conversation` — çalışan tarafı.
 *
 * `workerId` **gönderilmiyor**: parametre yokken backend çağıranı işçi sayıyor
 * (`MessagingManager.java:91`); işverenin açtığı yol `openApplicantConversation`
 * içinde ve `workerId` zorunlu. Uç var olan konuşmayı da aynı yanıtla
 * döndürüyor. Ödeme emanete düşmeden 403 `MESSAGING_PAYMENT_REQUIRED`, kapalı
 * pencerede 409 `MESSAGING_WINDOW_CLOSED` çıkıyor; ekran ikisini de atama
 * yanıtındaki `messagingAvailableReason` ile önden gösteriyor, buraya ancak
 * karar bayatladığında düşülür.
 */
export async function openWorkerConversation(jobId: string): Promise<string> {
  const conversation = await apiRequest<{ id?: string | null } | null>(
    `/jobs/${encodeURIComponent(jobId)}/conversation`,
    { method: "POST" },
  );
  const id = conversation?.id;
  if (!id) throw new Error("Conversation response is missing an identifier");
  return id;
}

export function sendConversationMessage(conversationId: string, body: string): Promise<Message> {
  return apiRequest<BackendMessage>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: { body } },
  ).then(toMessage);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiRequest(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}

export async function blockUser(userId: string): Promise<void> {
  await apiRequest(`/users/me/blocks/${encodeURIComponent(userId)}`, {
    method: "POST",
    body: {},
  });
}

export async function unblockUser(userId: string): Promise<void> {
  await apiRequest(`/users/me/blocks/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function isUserBlockedByViewer(userId: string): Promise<boolean> {
  const blocks = await apiRequest<readonly BackendUserBlock[]>("/users/me/blocks", {
    method: "GET",
    cache: "no-store",
  });
  return blocks.some((block) => block.blocked?.id === userId);
}

export async function reportContent(
  target: { messageId: string },
  reason: ReportReason,
  description?: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/reports", {
    method: "POST",
    body: {
      ...target,
      reason,
      ...(description === undefined ? {} : { description }),
    },
  });
}

export async function getUnreadState(): Promise<{
  total: number;
  byConversation: Record<string, number>;
}> {
  const byConversation: Record<string, number> = {};
  let page = 0;
  let last = false;
  do {
    const response = await apiRequest<BackendPage<BackendConversation>>(
      `/conversations?${new URLSearchParams({ page: String(page), size: "100" })}`,
      { method: "GET", cache: "no-store" },
    );
    (response.content ?? []).forEach((conversation) => {
      if (conversation.id) byConversation[conversation.id] = Math.max(0, conversation.unreadCount ?? 0);
    });
    last = response.last ?? page + 1 >= (response.totalPages ?? 0);
    page += 1;
  } while (!last);
  return {
    total: Object.values(byConversation).reduce((sum, count) => sum + count, 0),
    byConversation,
  };
}

export function getUserPresence(userId: string): Promise<{ userId: string; online: boolean }> {
  return apiRequest<BackendPresence>(`/users/${encodeURIComponent(userId)}/presence`, {
    method: "GET",
    cache: "no-store",
  }).then((value) => ({ userId: value.userId ?? userId, online: value.online === true }));
}

async function getPresenceSafely(userIds: readonly string[]) {
  const result = new Map<string, boolean>();
  if (userIds.length === 0) return result;
  try {
    const statuses = await apiRequest<BackendPresence[]>("/presence/lookup", {
      method: "POST",
      body: userIds,
      cache: "no-store",
    });
    statuses.forEach((status) => {
      if (status.userId) result.set(status.userId, status.online === true);
    });
  } catch (error) {
    unstable_rethrow(error);
    // Presence mesajlaşmanın kullanılabilirlik kapısı değildir. Liste REST ile
    // çalışmaya devam eder ve UI çevrimiçi bilgisi bilinmiyor durumunu çizer.
  }
  return result;
}

/**
 * Grup, ilanın sohbeti: başlığı ilanın adı, katılımcıları işveren tarafı ve
 * ödemesi alınmış çalışanlar. Şirket ilanında yetkililer de listede geliyor
 * (backend onları katılımcı yazıyor), yani `participants` görüntüleyeni de
 * içeriyor ve ad listesi onu düşüyor. `kind` eski bir yanıtta yoksa ikiden
 * fazla katılımcı yine grup sayılıyor: ikili konuşmanın üçüncü kişisi olmaz.
 *
 * Ayrılanlar (`left=true`, is-koala/koala-backend#281) sayıya ve ad listesine
 * girmiyor — satır kimlerle yazışıldığını söylüyor — ama `participants`
 * içinde kalıyor ki eski mesajlarının gönderen adı çözülsün.
 */
function toConversation(value: BackendConversation, viewerId: string): ConversationSummary {
  const rawParticipants = value.participants ?? [value.employer, value.worker].filter(isUser);
  const participants = rawParticipants.filter(hasId).map(toParticipant);
  const active = participants.filter((participant) => !participant.left);
  const others = active.filter((participant) => participant.id !== viewerId);
  const counterpart = others[0] ?? null;
  const isGroup = value.kind === "GROUP" || rawParticipants.length > 2;
  const displayName = isGroup
    ? (value.jobTitle?.trim() || "İlan grubu")
    : (counterpart?.name ?? "");

  return {
    id: value.id ?? "",
    jobId: value.jobId ?? null,
    jobTitle: value.jobTitle ?? null,
    kind: isGroup ? "GROUP" : "DIRECT",
    displayName: displayName || "Konuşma",
    participantCount: active.length,
    participantNames: others.map((participant) => participant.name).filter((name) => name !== ""),
    participants,
    readReceipts: rawParticipants.some((participant) => "lastReadAt" in participant),
    profilePictureUrl: isGroup ? null : (counterpart?.profilePictureUrl ?? null),
    counterpartId: isGroup ? null : (counterpart?.id ?? null),
    lastMessageAt: value.lastMessageAt ?? null,
    lastMessageBody: value.lastMessageBody ?? null,
    unreadCount: Math.max(0, value.unreadCount ?? 0),
    closed: value.closed === true,
    online: null,
  };
}

function toParticipant(value: BackendParticipant & { id: string }): ConversationParticipant {
  return {
    id: value.id,
    name: userName(value),
    profilePictureUrl: value.profilePictureUrl ?? null,
    role: participantRole(value.role),
    joinedAt: value.joinedAt ?? null,
    lastReadAt: value.lastReadAt ?? null,
    left: value.left === true,
  };
}

/** Tanınmayan rol `null`: panel o satırda rol yazmaz, uydurmaz. */
function participantRole(value: string | null | undefined): ConversationParticipantRole | null {
  return value === "EMPLOYER" || value === "COMPANY_CONTACT" || value === "WORKER" ? value : null;
}

function userName(user: BackendUser | null) {
  if (!user) return "";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || "";
}

function isUser(user: BackendUser | null | undefined): user is BackendUser {
  return user !== null && user !== undefined;
}

function hasId(user: BackendParticipant): user is BackendParticipant & { id: string } {
  return typeof user.id === "string" && user.id !== "";
}

function toMessage(value: BackendMessage): Message {
  return {
    id: value.id,
    senderId: value.senderId,
    senderName: normalizeSenderName(value.senderName),
    body: value.body,
    sentAt: value.sentAt,
    readAt: value.readAt ?? null,
  };
}

function pageOf<T>(response: BackendPage<unknown>, content: T[]): Page<T> {
  const page = response.page ?? response.number ?? 0;
  const totalPages = Math.max(0, response.totalPages ?? 0);
  return {
    content,
    page,
    totalPages,
    totalElements: Math.max(0, response.totalElements ?? content.length),
    last: response.last ?? page + 1 >= totalPages,
  };
}
