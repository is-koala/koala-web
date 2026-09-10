import { afterEach, describe, expect, it, vi } from "vitest";

import { smtpTransportOptions, supportMailbox } from "./mailer";

describe("destek postacısı", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("kutuyu yayımlanan iletişim adresine düşürür", () => {
    expect(supportMailbox()).toBe("info@iskoala.com");

    vi.stubEnv("SUPPORT_MAILBOX", " destek@iskoala.com ");
    expect(supportMailbox()).toBe("destek@iskoala.com");
  });

  it("SMTP host yoksa gönderimi yapılandırmaz", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(() => smtpTransportOptions()).toThrow("Zorunlu ortam değişkeni eksik: SMTP_HOST");
  });

  it("STARTTLS için 587 ve kimliği taşır", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "info@iskoala.com");
    vi.stubEnv("SMTP_PASSWORD", "not-a-secret-in-tests");

    expect(smtpTransportOptions()).toEqual({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "info@iskoala.com", pass: "not-a-secret-in-tests" },
    });
  });
});
