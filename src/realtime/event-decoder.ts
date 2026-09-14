export type RealtimeEvent = {
  type: "MESSAGE" | "TYPING" | "READ" | "PRESENCE" | "ERROR";
  conversationId: string | null;
  userId: string | null;
  message: unknown;
  online: boolean | null;
  at: string;
  /**
   * Yalnız `READ`: okuyanın (`userId`) yeni `lastReadAt` damgası
   * (is-koala/koala-backend#281). Eski sunucu alanı hiç yazmıyor; o zaman
   * `undefined` kalır ve istemci olayın `at` zamanına düşer.
   */
  lastReadAt?: string | null;
  error: { destination: string; errorCode: string; message: string } | null;
};

const eventTypes = new Set<RealtimeEvent["type"]>([
  "MESSAGE", "TYPING", "READ", "PRESENCE", "ERROR",
]);

export function realtimeEventOf(body: string): RealtimeEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<RealtimeEvent>;
  if (typeof candidate.type !== "string" ||
      !eventTypes.has(candidate.type as RealtimeEvent["type"])) {
    return null;
  }
  if (typeof candidate.at !== "string") return null;
  if (!(candidate.conversationId === null || typeof candidate.conversationId === "string")) {
    return null;
  }
  if (!(candidate.userId === null || typeof candidate.userId === "string")) return null;
  if (!(candidate.online === null || typeof candidate.online === "boolean")) return null;
  if (!(
    candidate.lastReadAt === undefined
    || candidate.lastReadAt === null
    || typeof candidate.lastReadAt === "string"
  )) {
    return null;
  }
  if (!(candidate.error === null || isRealtimeError(candidate.error))) return null;
  return candidate as RealtimeEvent;
}

function isRealtimeError(value: unknown): value is NonNullable<RealtimeEvent["error"]> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NonNullable<RealtimeEvent["error"]>>;
  return typeof candidate.destination === "string" &&
    typeof candidate.errorCode === "string" && typeof candidate.message === "string";
}
