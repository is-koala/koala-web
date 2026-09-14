import { idleActionState, type ActionFailure, type ActionFor } from "@/lib/form-state";

export type Message = {
  id: string;
  senderId: string;
  /**
   * `MessageDto.senderName` (is-koala/koala-backend#281). Eski sunucuda yok;
   * grup balonu o zaman adı `participants` eşlemesinden çözer.
   */
  senderName: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type ConversationKind = "DIRECT" | "GROUP";

/**
 * `ConversationParticipantDto.role`. İşveren tarafı ilan sahibi ya da şirket
 * yetkilisi; çalışan ödemesi emanete alınmış kişi. Eski sunucuda alan yok,
 * `null` "bilinmiyor" demek ve panel rolü o satırda hiç yazmaz.
 */
export type ConversationParticipantRole = "EMPLOYER" | "COMPANY_CONTACT" | "WORKER";

export type ConversationParticipant = {
  /** Kullanıcı kimliği; `Message.senderId` ile eşleşir. */
  id: string;
  name: string;
  profilePictureUrl: string | null;
  role: ConversationParticipantRole | null;
  joinedAt: string | null;
  /**
   * `POST /conversations/{id}/read` ile en son okuduğu an. "Görüldü"
   * `lastReadAt >= sentAt` ile hesaplanır; hiç okumadıysa ya da sunucu alanı
   * taşımıyorsa `null`.
   */
  lastReadAt: string | null;
  /** Sohbetten ayrıldı; eski mesajlarının adı çözülsün diye listede kalır. */
  left: boolean;
};

export type ConversationSummary = {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  /**
   * `ConversationDto.kind`. Grup, ödeme emanete düştüğünde ilan başına kurulur
   * ve işveren tarafı — ilan sahibi ya da şirket yetkilileri — ile ödemesi
   * alınmış çalışanları toplar. Liste satırı grubu ilan başlığıyla çizer.
   */
  kind: ConversationKind;
  displayName: string;
  /** Grupta katılımcı sayısı; ikili konuşmada 2. */
  participantCount: number;
  /** Görüntüleyen dışındaki katılımcıların adları; adı boş olan atlanır. */
  participantNames: readonly string[];
  /**
   * Görüntüleyen dahil, ayrılanlar da içinde tüm katılımcılar. Grup
   * balonundaki gönderen adı, katılımcılar paneli ve "görüldü" buradan.
   */
  participants: readonly ConversationParticipant[];
  /**
   * Sunucu `participants[].lastReadAt` taşıyor mu. Alan yoksa grupta
   * "görüldü" hiç çizilmez: eski bir sunucuda herkesi "görmedi" saymak
   * yanlış bilgi olurdu.
   */
  readReceipts: boolean;
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

/**
 * Atama yanıtlarındaki mesajlaşma kapısı.
 *
 * Kaynak `messagingAvailable` + `messagingAvailableReason`
 * (is-koala/koala-backend#257): ödeme emanete düşmeden ikili sohbet açılmıyor
 * ve `POST /jobs/{jobId}/conversation` 403 `MESSAGING_PAYMENT_REQUIRED`
 * döndürüyor. Ekran bu yüzden düğmeyi yanıttaki karara göre çiziyor; kuralı
 * `paymentStatus`tan yeniden türetmiyor — kapanış penceresi (iş bitiminden 7
 * gün) ve iptal/iade dalları yalnız sunucuda okunuyor.
 */
export type MessagingAvailabilityReason = "PAYMENT_REQUIRED" | "CLOSED" | "AVAILABLE";

export type MessagingAvailability = {
  readonly available: boolean;
  readonly reason: MessagingAvailabilityReason;
};

/**
 * Yanıttaki iki alanı tek karara indirir; alan yoksa `null`.
 *
 * `null` "kapalı" değil "bilinmiyor" demek: eski bir önbellek ya da alanı
 * henüz taşımayan bir uç bu duruma düşer ve ekran mesaj bağlantısını **hiç**
 * çizmez. `false` ile tanınmayan bir neden de aynı yere düşüyor — nedeni
 * okunamayan bir kapıyı "ödeme gerekli" diye anlatmak yanlış yola gönderirdi.
 */
export function messagingAvailabilityFrom(dto: {
  messagingAvailable?: boolean | null;
  messagingAvailableReason?: string | null;
}): MessagingAvailability | null {
  if (dto.messagingAvailable === true) return { available: true, reason: "AVAILABLE" };
  if (dto.messagingAvailable !== false) return null;
  const reason = dto.messagingAvailableReason;
  if (reason === "PAYMENT_REQUIRED" || reason === "CLOSED") return { available: false, reason };
  return null;
}

/**
 * Konuşma açma eyleminin durumu.
 *
 * Başarı burada bir dal değil: sunucu eylemi konuşma kimliğini alır almaz
 * mesaj kabuğuna yönlendiriyor (`redirect`), geriye yalnız red kalıyor.
 * İşverenin aday kartı ile çalışanın iş ayrıntısı aynı üçlüyü paylaşıyor.
 */
export type ConversationState =
  | { readonly status: "idle" }
  | ({ readonly status: "error" } & ActionFailure);

export const idleConversationState: ConversationState = idleActionState;

export type ConversationAction = ActionFor<ConversationState>;

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
