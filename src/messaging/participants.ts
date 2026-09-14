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
  const name = message.senderName ?? participant?.name ?? "";
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
 * Listede olmayan okuyucu — sayfa açıldıktan sonra katılan biri — burada
 * işlenemez; çağıran `knowsParticipant` ile bunu görüp özeti tazeler.
 */
export function applyReadEvent(
  participants: readonly ConversationParticipant[],
  userId: string,
  lastReadAt: string,
): readonly ConversationParticipant[] {
  let changed = false;
  const next = participants.map((participant) => {
    if (participant.id !== userId) return participant;
    if (!isLater(lastReadAt, participant.lastReadAt)) return participant;
    changed = true;
    return { ...participant, lastReadAt };
  });
  return changed ? next : participants;
}

export function knowsParticipant(
  participants: readonly ConversationParticipant[],
  userId: string,
): boolean {
  return participants.some((participant) => participant.id === userId);
}

/**
 * Yeniden okunan özetin katılımcılarını eldeki damgalarla birleştirir.
 *
 * Özet, tazeleme isteği yoldayken gelen bir READ olayından eski olabilir;
 * bu yüzden her katılımcının damgası iki kaynağın ileri olanı. Liste (kim
 * var, kim ayrıldı, rol) özetten gelir: onu yalnız sunucu bilir.
 */
export function mergeParticipants(
  current: readonly ConversationParticipant[],
  fresh: readonly ConversationParticipant[],
): readonly ConversationParticipant[] {
  return fresh.map((participant) => {
    const known = current.find((item) => item.id === participant.id);
    if (!known || !isLater(known.lastReadAt, participant.lastReadAt)) return participant;
    return { ...participant, lastReadAt: known.lastReadAt };
  });
}

function isLater(candidate: string | null, reference: string | null): candidate is string {
  if (candidate === null) return false;
  return reference === null || Date.parse(candidate) > Date.parse(reference);
}
