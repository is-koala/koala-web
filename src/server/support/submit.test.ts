import { describe, expect, it, vi } from "vitest";

import { createSupportQuota } from "./rate-limit";
import { submitSupportRequest, type SupportMailer } from "./submit";

const valid = {
  topic: "destek",
  name: "Ada Yılmaz",
  email: "ada@example.test",
  message: "Hesap silme talebim görünmüyor.",
  consent: true,
  honeypot: "",
  clientKey: "198.51.100.10",
};

function mailer(): SupportMailer & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

describe("destek başvurusu", () => {
  it("geçerli gönderimi destek kutusuna konu, ad, e-posta ve mesajla yollar", async () => {
    const outbound = mailer();

    await expect(
      submitSupportRequest(valid, {
        mailer: outbound,
        takeQuota: () => ({ allowed: true }),
        mailbox: "info@iskoala.com",
      }),
    ).resolves.toEqual({ status: "done" });

    expect(outbound.send).toHaveBeenCalledTimes(1);
    expect(outbound.send).toHaveBeenCalledWith({
      to: "info@iskoala.com",
      replyTo: "ada@example.test",
      subject: "[Koala] Destek — Ada Yılmaz",
      text: [
        "Konu: Destek",
        "Ad: Ada Yılmaz",
        "E-posta: ada@example.test",
        "",
        "Hesap silme talebim görünmüyor.",
      ].join("\n"),
    });
  });

  it("boş ve geçersiz alanları Türkçe alan hatalarıyla reddeder", async () => {
    const outbound = mailer();

    await expect(
      submitSupportRequest(
        {
          topic: "",
          name: "  ",
          email: "ada",
          message: "",
          consent: false,
          honeypot: "",
          clientKey: "198.51.100.10",
        },
        {
          mailer: outbound,
          takeQuota: () => ({ allowed: true }),
          mailbox: "info@iskoala.com",
        },
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: {
        topic: "Konu seçmen gerekiyor.",
        name: "Adını yaz.",
        email: "Geçerli bir e-posta adresi yaz.",
        message: "Mesajını yaz.",
        consent: "Aydınlatma metnini okuduğunu onaylaman gerekiyor.",
      },
    });
    expect(outbound.send).not.toHaveBeenCalled();
  });

  it("bal küpü doluysa başarı döner ve posta göndermez", async () => {
    const outbound = mailer();

    await expect(
      submitSupportRequest(
        { ...valid, honeypot: "http://spam.example" },
        {
          mailer: outbound,
          takeQuota: () => ({ allowed: true }),
          mailbox: "info@iskoala.com",
        },
      ),
    ).resolves.toEqual({ status: "done" });
    expect(outbound.send).not.toHaveBeenCalled();
  });

  it("hız sınırı dolunca 429 döner ve posta göndermez", async () => {
    const outbound = mailer();
    const takeQuota = createSupportQuota({
      clientLimit: 1,
      globalLimit: 10,
      now: () => 1_000,
      windowMs: 60_000,
    });

    await submitSupportRequest(valid, {
      mailer: outbound,
      takeQuota,
      mailbox: "info@iskoala.com",
    });

    await expect(
      submitSupportRequest(
        { ...valid, email: "ada2@example.test" },
        { mailer: outbound, takeQuota, mailbox: "info@iskoala.com" },
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(outbound.send).toHaveBeenCalledTimes(1);
  });

  it("posta gönderilemezse D4 dış hizmet koduna düşer", async () => {
    const outbound = mailer();
    outbound.send.mockRejectedValueOnce(new Error("ada@example.test hesabı reddedildi"));

    await expect(
      submitSupportRequest(valid, {
        mailer: outbound,
        takeQuota: () => ({ allowed: true }),
        mailbox: "info@iskoala.com",
      }),
    ).resolves.toEqual({
      status: "error",
      errorCode: "EMAIL_SEND_FAILED",
      httpStatus: 502,
    });
  });
});

describe("destek hız sınırı", () => {
  it("aynı istemciyi ve süreç toplamını ayrı keser", () => {
    const take = createSupportQuota({ clientLimit: 2, globalLimit: 3 });

    expect(take("198.51.100.1").allowed).toBe(true);
    expect(take("198.51.100.1").allowed).toBe(true);
    expect(take("198.51.100.1").allowed).toBe(false);
    expect(take("198.51.100.2").allowed).toBe(true);
    expect(take("198.51.100.3").allowed).toBe(false);
  });
});
