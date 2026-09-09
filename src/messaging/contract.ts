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
};

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
