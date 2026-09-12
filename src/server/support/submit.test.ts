import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { createSupportQuota } from "./rate-limit";
import { submitSupportRequest, type SubmitSupportDependencies } from "./submit";

const valid = {
  topic: "destek",
  name: "Ada Yılmaz",
  email: "ada@example.test",
  message: "Hesap silme talebim görünmüyor.",
  consent: true,
  honeypot: "",
  clientKey: "198.51.100.10",
};

function contact(): SubmitSupportDependencies["submit"] & ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(undefined);
}

describe("destek başvurusu", () => {
  it("geçerli gönderimi backend iletişim ucuna konu, ad, e-posta ve mesajla yollar", async () => {
    const submit = contact();

    await expect(
      submitSupportRequest(valid, {
        submit,
        takeQuota: () => ({ allowed: true }),
      }),
    ).resolves.toEqual({ status: "done" });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      topic: "destek",
      name: "Ada Yılmaz",
      email: "ada@example.test",
      message: "Hesap silme talebim görünmüyor.",
      consent: true,
    });
  });

  it("boş ve geçersiz alanları Türkçe alan hatalarıyla reddeder", async () => {
    const submit = contact();

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
          submit,
          takeQuota: () => ({ allowed: true }),
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
    expect(submit).not.toHaveBeenCalled();
  });

  it("bal küpü doluysa başarı döner ve backend'i çağırmaz", async () => {
    const submit = contact();

    await expect(
      submitSupportRequest(
        { ...valid, honeypot: "http://spam.example" },
        {
          submit,
          takeQuota: () => ({ allowed: true }),
        },
      ),
    ).resolves.toEqual({ status: "done" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("hız sınırı dolunca 429 döner ve backend'i çağırmaz", async () => {
    const submit = contact();
    const takeQuota = createSupportQuota({
      clientLimit: 1,
      globalLimit: 10,
      now: () => 1_000,
      windowMs: 60_000,
    });

    await submitSupportRequest(valid, { submit, takeQuota });

    await expect(
      submitSupportRequest(
        { ...valid, email: "ada2@example.test" },
        { submit, takeQuota },
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("kuyruk hatasını D4 dış hizmet koduna düşürür", async () => {
    const submit = contact();
    submit.mockRejectedValueOnce(
      new ApiError({
        status: 502,
        errorCode: "EMAIL_SEND_FAILED",
        errorCategory: "UPSTREAM_FAILED",
        message: "E-posta gönderilemedi.",
      }),
    );

    await expect(
      submitSupportRequest(valid, {
        submit,
        takeQuota: () => ({ allowed: true }),
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
