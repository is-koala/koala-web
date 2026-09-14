import type { ConversationParticipant } from "@/messaging/contract";

/**
 * Katılımcı fikstürü; mantık testi ile bileşen testi aynı şekli kuruyor.
 * Varsayılan katılımcı aktif, rolsüz ve hiç okumamış: her test yalnız
 * baktığı alanı yazar, kalan alan sözleşme değişince tek yerde güncellenir.
 */
export function participant(
  id: string,
  name: string,
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id,
    name,
    profilePictureUrl: null,
    role: null,
    joinedAt: null,
    lastReadAt: null,
    left: false,
    ...overrides,
  };
}
