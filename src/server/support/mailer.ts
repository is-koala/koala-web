import "server-only";

import { createTransport } from "nodemailer";

import { controllerIdentity } from "@/content/support";
import { requiredEnvironmentValue } from "@/lib/env";

import type { SupportMailer } from "./submit";

export function supportMailbox(): string {
  return process.env.SUPPORT_MAILBOX?.trim() || controllerIdentity.email;
}

export function supportMailFrom(): string {
  return process.env.SUPPORT_MAIL_FROM?.trim() || supportMailbox();
}

export function smtpMailer(): SupportMailer {
  return {
    async send(mail) {
      const transport = createTransport(smtpTransportOptions());
      try {
        await transport.sendMail({
          from: supportMailFrom(),
          to: mail.to,
          replyTo: mail.replyTo,
          subject: mail.subject,
          text: mail.text,
        });
      } finally {
        transport.close();
      }
    },
  };
}

export function smtpTransportOptions() {
  const host = requiredEnvironmentValue("SMTP_HOST", process.env.SMTP_HOST);
  const port = smtpPort();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;

  return {
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: password ?? "" } : undefined,
  };
}

function smtpPort(): number {
  const raw = process.env.SMTP_PORT?.trim() || "587";
  if (!/^\d+$/.test(raw)) {
    throw new Error("SMTP_PORT 1 ile 65535 arasında bir tam sayı olmalı.");
  }
  const port = Number(raw);
  if (port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT 1 ile 65535 arasında bir tam sayı olmalı.");
  }
  return port;
}
