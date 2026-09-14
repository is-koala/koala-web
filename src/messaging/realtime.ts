import { normalizeSenderName, type Message } from "./contract";

export function messageFromRealtime(value: unknown): Message | null {
  if (typeof value !== "object" || value === null) return null;
  const message = value as Partial<Message>;
  if (
    typeof message.id !== "string" ||
    typeof message.senderId !== "string" ||
    typeof message.body !== "string" ||
    typeof message.sentAt !== "string" ||
    !(message.readAt === null || typeof message.readAt === "string")
  ) {
    return null;
  }
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: normalizeSenderName(message.senderName),
    body: message.body,
    sentAt: message.sentAt,
    readAt: message.readAt,
  };
}
