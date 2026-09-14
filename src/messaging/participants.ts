import type { ConversationParticipant, ConversationParticipantRole, Message } from "./contract";

export const participantRoleLabels: Record<ConversationParticipantRole, string> = {
  EMPLOYER: "İşveren",
  COMPANY_CONTACT: "Şirket yetkilisi",
  WORKER: "Çalışan",
};

/** Adı çözülemeyen gönderen için balon etiketi. */
export const unknownSenderLabel = "Ayrılan katılımcı";

export type SenderPresentation = {
  name: string;
  /** Gönderen sohbetten ayrılmış ya da artık katılımcı listesinde yok. */
  left: boolean;
};

/**
 * Grup balonunun üstündeki gönderen satırı.
 *
 * Kendi mesajında yok. Ad önce mesajın kendi `senderName`inden geliyor —
 * backend orada silinen hesabı "Anonim Kullanıcı" diye anonimleştiriyor —
 * alan yoksa (eski sunucu) `participants` eşlemesinden. Listede olmayan bir
 * gönderen ayrılmış sayılır: eski sunucu ayrılanı listeden düşüyor, yenisi
 * `left=true` ile tutuyor; iki durumda da balon "Ayrıldı" der.
 */
export function senderPresentation(
  message: Pick<Message, "senderId" | "senderName">,
  participants: readonly ConversationParticipant[],
  viewerId: string,
): SenderPresentation | null {
  if (message.senderId === viewerId) return null;
  const participant = participants.find((item) => item.id === message.senderId) ?? null;
  const name = message.senderName?.trim() || participant?.name || "";
  if (name === "") return { name: unknownSenderLabel, left: true };
  return { name, left: participant === null || participant.left };
}

/**
 * Bir mesajı görmüş katılımcılar; görüntüleyen dışında.
 *
 * Ölçü `lastReadAt >= sentAt`: backend kişi başına yalnız son okuma damgasını
 * tutuyor, mesaj başına liste yok. Ayrılan biri ayrılmadan önce okuduysa
 * listede kalır; damgası mesajdan eskiyse görmemiştir.
 */
export function seenBy(
  message: Pick<Message, "sentAt">,
  participants: readonly ConversationParticipant[],
  viewerId: string,
): ConversationParticipant[] {
  const sentAt = Date.parse(message.sentAt);
  return participants.filter((participant) =>
    participant.id !== viewerId &&
    participant.lastReadAt !== null &&
    Date.parse(participant.lastReadAt) >= sentAt,
  );
}

/**
 * STOMP `READ` olayını katılımcı listesine işler.
 *
 * Olay okuyan başına geliyor (`userId`) ve `lastReadAt` damgasını taşıyor;
 * damga yoksa (eski sunucu) olayın kendi zamanı kullanılır. Damga geriye
 * gitmez: sırası karışmış iki olay "gördü"yü "görmedi"ye çeviremez.
 */
export function applyReadEvent(
  participants: readonly ConversationParticipant[],
  userId: string,
  lastReadAt: string,
): readonly ConversationParticipant[] {
  let changed = false;
  const next = participants.map((participant) => {
    if (participant.id !== userId) return participant;
    if (participant.lastReadAt !== null && Date.parse(participant.lastReadAt) >= Date.parse(lastReadAt)) {
      return participant;
    }
    changed = true;
    return { ...participant, lastReadAt };
  });
  return changed ? next : participants;
}
