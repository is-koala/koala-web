import { beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";

const send = vi.hoisted(() => vi.fn());
const takeQuota = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => new Headers({ "x-real-ip": "198.51.100.10" }));

vi.mock("@/server/support/mailer", () => ({
  smtpMailer: () => ({ send }),
  supportMailbox: () => "info@iskoala.com",
}));
vi.mock("@/server/support/rate-limit", () => ({
  takeSupportQuota: takeQuota,
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders),
}));

import { submitSupportAction } from "./actions";

function submission(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

const valid = {
  topic: "kvkk",
  name: "Ada Yılmaz",
  email: "ada@example.test",
  message: "Verilerimin silinmesini istiyorum.",
  consent: "granted",
};

describe("destek formu action'ı", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
    takeQuota.mockReset();
    takeQuota.mockReturnValue({ allowed: true });
    requestHeaders.set("x-real-ip", "198.51.100.10");
  });

  it("form alanlarını beklenen SMTP yüküne çevirir", async () => {
    await expect(submitSupportAction(idleFormState, submission(valid))).resolves.toEqual({
      status: "done",
    });

    expect(takeQuota).toHaveBeenCalledWith("198.51.100.10");
    expect(send).toHaveBeenCalledWith({
      to: "info@iskoala.com",
      replyTo: "ada@example.test",
      subject: "[Koala] KVKK — Ada Yılmaz",
      text: [
        "Konu: KVKK",
        "Ad: Ada Yılmaz",
        "E-posta: ada@example.test",
        "",
        "Verilerimin silinmesini istiyorum.",
      ].join("\n"),
    });
  });

  it("bal küpü doluysa postacıyı çağırmaz", async () => {
    await expect(
      submitSupportAction(idleFormState, submission({ ...valid, website: "http://bot.test" })),
    ).resolves.toEqual({ status: "done" });
    expect(send).not.toHaveBeenCalled();
  });

  it("hız sınırını forma D4 koduyla taşır", async () => {
    takeQuota.mockReturnValue({ allowed: false });

    await expect(submitSupportAction(idleFormState, submission(valid))).resolves.toEqual({
      status: "error",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
