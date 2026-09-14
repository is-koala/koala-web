import { describe, expect, it } from "vitest";

import { realtimeEventOf } from "./event-decoder";

const conversationId = "33333333-3333-4333-8333-333333333333";
const readerId = "22222222-2222-4222-8222-222222222222";

describe("gerçek zamanlı olay çözücü", () => {
  it("READ olayının lastReadAt damgasını taşır (is-koala/koala-backend#281)", () => {
    const event = realtimeEventOf(JSON.stringify({
      type: "READ",
      conversationId,
      userId: readerId,
      message: null,
      online: null,
      at: "2026-09-06T12:00:01Z",
      lastReadAt: "2026-09-06T12:00:00Z",
      error: null,
    }));

    expect(event).toMatchObject({ type: "READ", userId: readerId, lastReadAt: "2026-09-06T12:00:00Z" });
  });

  it("eski sunucunun damgasız READ olayını da kabul eder", () => {
    const withoutField = realtimeEventOf(JSON.stringify({
      type: "READ", conversationId, userId: readerId, message: null, online: null,
      at: "2026-09-06T12:00:01Z", error: null,
    }));
    const withNull = realtimeEventOf(JSON.stringify({
      type: "READ", conversationId, userId: readerId, message: null, online: null,
      at: "2026-09-06T12:00:01Z", lastReadAt: null, error: null,
    }));

    expect(withoutField?.lastReadAt).toBeUndefined();
    expect(withNull?.lastReadAt).toBeNull();
  });

  it("biçimsiz lastReadAt taşıyan olayı düşürür", () => {
    expect(realtimeEventOf(JSON.stringify({
      type: "READ", conversationId, userId: readerId, message: null, online: null,
      at: "2026-09-06T12:00:01Z", lastReadAt: 1_757_160_000, error: null,
    }))).toBeNull();
  });
});
