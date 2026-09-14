import { describe, expect, it } from "vitest";

import { participant } from "../../tests/support/messaging";

import type { ConversationParticipant } from "./contract";
import {
  applyReadEvent,
  knowsParticipant,
  mergeParticipants,
  seenBy,
  senderPresentation,
  unknownSenderLabel,
} from "./participants";

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const leftId = "33333333-3333-4333-8333-333333333333";

const participants: readonly ConversationParticipant[] = [
  participant(viewerId, "Deniz Ak", { lastReadAt: "2026-09-06T12:00:00Z" }),
  participant(otherId, "Ece Yılmaz", { lastReadAt: "2026-09-06T11:00:00Z" }),
  participant(leftId, "Mehmet Kaya", { lastReadAt: "2026-09-06T10:00:00Z", left: true }),
];

describe("grup katılımcıları", () => {
  it("gönderen adını önce senderName'den, yoksa katılımcı listesinden çözer", () => {
    expect(senderPresentation(
      { senderId: otherId, senderName: "Ece Y." },
      participants,
      viewerId,
    )).toEqual({ name: "Ece Y.", left: false });
    expect(senderPresentation(
      { senderId: otherId, senderName: null },
      participants,
      viewerId,
    )).toEqual({ name: "Ece Yılmaz", left: false });
  });

  it("kendi mesajında gönderen satırı çizmez", () => {
    expect(senderPresentation({ senderId: viewerId, senderName: "Deniz Ak" }, participants, viewerId))
      .toBeNull();
  });

  it("ayrılanı ve listede olmayanı 'Ayrıldı' olarak işaretler", () => {
    // Yeni sunucu ayrılanı `left=true` ile tutuyor; eski sunucu listeden
    // düşüyor. İki durumda da balon ayrıldığını söyler, adı biliyorsa yazar.
    expect(senderPresentation({ senderId: leftId, senderName: null }, participants, viewerId))
      .toEqual({ name: "Mehmet Kaya", left: true });
    expect(senderPresentation({ senderId: "unknown", senderName: "Zeynep Demir" }, participants, viewerId))
      .toEqual({ name: "Zeynep Demir", left: true });
    expect(senderPresentation({ senderId: "unknown", senderName: null }, participants, viewerId))
      .toEqual({ name: unknownSenderLabel, left: true });
  });

  it("görenleri lastReadAt >= sentAt ile sayar ve görüntüleyeni dışarıda tutar", () => {
    const seen = seenBy({ sentAt: "2026-09-06T10:30:00Z" }, participants, viewerId);
    expect(seen.map((item) => item.id)).toEqual([otherId]);
    // Ayrılan, ayrılmadan önce okuduysa görmüş sayılır.
    expect(seenBy({ sentAt: "2026-09-06T09:00:00Z" }, participants, viewerId).map((item) => item.id))
      .toEqual([otherId, leftId]);
    // Damgası olmayan ya da damgası mesajdan eski olan görmemiştir.
    expect(seenBy({ sentAt: "2026-09-06T11:00:01Z" }, participants, viewerId)).toEqual([]);
  });

  it("READ olayını okuyanın damgasına işler; geriye gitmez, yabancıyı yok sayar", () => {
    const advanced = applyReadEvent(participants, otherId, "2026-09-06T13:00:00Z");
    expect(advanced.find((item) => item.id === otherId)?.lastReadAt).toBe("2026-09-06T13:00:00Z");
    expect(applyReadEvent(advanced, otherId, "2026-09-06T12:30:00Z")).toBe(advanced);
    expect(applyReadEvent(participants, "unknown", "2026-09-06T13:00:00Z")).toBe(participants);
  });

  it("hiç okumamış katılımcının ilk damgasını yazar", () => {
    const fresh = [participant(otherId, "Ece Yılmaz")];
    expect(applyReadEvent(fresh, otherId, "2026-09-06T13:00:00Z")[0]?.lastReadAt)
      .toBe("2026-09-06T13:00:00Z");
  });

  it("listede olmayan okuyucuyu bildirir ki çağıran özeti tazelesin", () => {
    expect(knowsParticipant(participants, otherId)).toBe(true);
    expect(knowsParticipant(participants, "newcomer")).toBe(false);
  });

  it("tazelenen özeti birleştirirken listeyi sunucudan, damgayı ileri olandan alır", () => {
    // Özet, yoldayken gelen READ'den eski olabilir: Ece'nin eldeki damgası
    // (13:00) özetteki (11:00) damgayı ezmez; yeni katılan özetten gelir,
    // ayrılma ve rol da öyle.
    const current = applyReadEvent(participants, otherId, "2026-09-06T13:00:00Z");
    const fresh = [
      participant(viewerId, "Deniz Ak", { lastReadAt: "2026-09-06T12:30:00Z" }),
      participant(otherId, "Ece Yılmaz", { role: "WORKER", lastReadAt: "2026-09-06T11:00:00Z" }),
      participant("newcomer", "Ali Can", { lastReadAt: "2026-09-06T12:45:00Z" }),
    ];

    const merged = mergeParticipants(current, fresh);

    expect(merged.map((item) => item.id)).toEqual([viewerId, otherId, "newcomer"]);
    expect(merged[0]?.lastReadAt).toBe("2026-09-06T12:30:00Z");
    expect(merged[1]).toMatchObject({ role: "WORKER", lastReadAt: "2026-09-06T13:00:00Z" });
    expect(merged[2]?.lastReadAt).toBe("2026-09-06T12:45:00Z");
  });
});
