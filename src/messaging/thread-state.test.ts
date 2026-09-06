import { describe, expect, it } from "vitest";

import type { Message } from "./contract";
import {
  appendMessage,
  failPendingMessage,
  initialThreadState,
  markMessagesRead,
  reconcilePendingMessage,
  startPendingMessage,
} from "./thread-state";

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

describe("konuşma durum makinesi", () => {
  it("REST ve topic üzerinden gelen aynı mesajı kimliğiyle tekilleştirir", () => {
    const incoming = message("33333333-3333-4333-8333-333333333333", otherId, "Merhaba");
    const once = appendMessage(initialThreadState([]), incoming);

    expect(appendMessage(once, incoming).messages).toHaveLength(1);
  });

  it("iyimser mesajı sunucu yanıtıyla uzlaştırır; topic önce geldiyse kopya bırakmaz", () => {
    const optimistic = startPendingMessage(initialThreadState([]), {
      clientId: "local-1",
      senderId: viewerId,
      body: "Geliyorum",
      sentAt: "2026-09-06T11:00:00Z",
    });
    const saved = message("44444444-4444-4444-8444-444444444444", viewerId, "Geliyorum");
    const topicFirst = appendMessage(optimistic, saved);
    const settled = reconcilePendingMessage(topicFirst, "local-1", saved);

    expect(settled.messages).toEqual([{ ...saved, delivery: "sent", clientId: null }]);
  });

  it("başarısız iyimser mesajı tekrar denenebilir olarak tutar", () => {
    const optimistic = startPendingMessage(initialThreadState([]), {
      clientId: "local-2",
      senderId: viewerId,
      body: "Tekrar dene",
      sentAt: "2026-09-06T11:00:00Z",
    });

    expect(failPendingMessage(optimistic, "local-2").messages[0]).toMatchObject({
      body: "Tekrar dene",
      delivery: "failed",
      clientId: "local-2",
    });
  });

  it("karşı tarafın READ olayıyla yalnız kullanıcının gönderilerini okundu yapar", () => {
    const mine = message("55555555-5555-4555-8555-555555555555", viewerId, "Benden");
    const theirs = message("66666666-6666-4666-8666-666666666666", otherId, "Ondan");
    const state = initialThreadState([mine, theirs]);

    const next = markMessagesRead(state, viewerId, "2026-09-06T11:05:00Z");

    expect(next.messages[0]?.readAt).toBe("2026-09-06T11:05:00Z");
    expect(next.messages[1]?.readAt).toBeNull();
  });
});

function message(id: string, senderId: string, body: string): Message {
  return { id, senderId, body, sentAt: "2026-09-06T11:01:00Z", readAt: null };
}
