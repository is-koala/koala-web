export type Message = {
  id: string;
  senderId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type ConversationSummary = {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  displayName: string;
  profilePictureUrl: string | null;
  counterpartId: string | null;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  unreadCount: number;
  closed: boolean;
  /** Presence yardımcı bir sinyaldir; okunamazsa `null` kalır. */
  online: boolean | null;
  /** Bu özetin server tarafından doğrulandığı 100 kayıtlık liste sayfası. */
  sourcePage?: number;
};

export const conversationListPageSize = 100;
export const maxConversationSourcePage = 10_000;

export function isConversationSourcePage(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maxConversationSourcePage;
}

export type Page<T> = {
  content: T[];
  page: number;
  totalPages: number;
  totalElements: number;
  last: boolean;
};

export type MessagingActionFailure = {
  ok: false;
  errorCode: string;
  status: number;
  blocked: boolean;
  requestId?: string;
};

export type LoadConversationSummaryResult =
  | { ok: true; conversation: ConversationSummary }
  | MessagingActionFailure;

export type SendMessageResult =
  | { ok: true; message: Message }
  | MessagingActionFailure;

export type LoadMessagesResult =
  | { ok: true; page: Page<Message> }
  | MessagingActionFailure;

export type MessagingMutationResult =
  | { ok: true }
  | MessagingActionFailure;

export type MessageReportResult =
  | { ok: true; reportId: string }
  | MessagingActionFailure;

export const reportReasons = [
  "SPAM",
  "HARASSMENT",
  "FRAUD",
  "OFF_PLATFORM_PAYMENT",
  "INAPPROPRIATE_CONTENT",
  "FAKE_PROFILE",
  "NO_SHOW",
  "OTHER",
] as const;

export type ReportReason = (typeof reportReasons)[number];

export const reportReasonLabels: Record<ReportReason, string> = {
  SPAM: "Spam veya reklam",
  HARASSMENT: "Taciz, hakaret veya tehdit",
  FRAUD: "Dolandırıcılık",
  OFF_PLATFORM_PAYMENT: "Platform dışı ödeme isteği",
  INAPPROPRIATE_CONTENT: "Uygunsuz içerik",
  FAKE_PROFILE: "Sahte profil",
  NO_SHOW: "İşe gelmedi",
  OTHER: "Diğer",
};
