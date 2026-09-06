"use client";

import Image from "next/image";
import Link from "next/link";

import { contactRoleLabel, personName } from "@/lib/company-contacts";
import type { FormAction } from "@/lib/form-state";
import {
  invitationDecision,
  invitationStatusLabel,
  type CompanyContactInvitation,
} from "@/lib/invitations";

import { InvitationDecisionForm } from "./invitation-decision";

/**
 * Davet karşılama sayfası.
 *
 * Okuduğu daveti oturum sahibine ait **varsaymıyor**:
 * `GET /contact-invitations/{invitationId}` sahiplik denetimi yapmıyor
 * (`CompanyContactInvitationManager.java:149-155`) ama cevaplama ucu
 * yapıyor ve başkasının davetine 403 döndürüyor (`:93-95`). Kararı
 * `invitationDecision` veriyor; bu bileşen yalnız çiziyor.
 */
export type InvitationPageProps = {
  invitation: CompanyContactInvitation;
  /** Oturum sahibinin kimliği; sahiplik kararı buna bakıyor. */
  viewerId: string;
  action: FormAction;
};

export function InvitationPageView({ invitation, viewerId, action }: InvitationPageProps) {
  const decision = invitationDecision(invitation, viewerId);

  return (
    <section className="account-card">
      <p className="eyebrow">Şirket daveti</p>
      <div className="contact-identity">
        <CompanyLogo invitation={invitation} />
        <div>
          <h1>{invitation.company.name}</h1>
          <p className="lede">
            {personName(invitation.invitedBy)} seni bu şirkete yetkili olarak davet etti.
          </p>
        </div>
      </div>

      <dl className="job-facts">
        <div>
          <dt>Davet eden</dt>
          <dd>{personName(invitation.invitedBy)}</dd>
        </div>
        <div>
          <dt>Verilen rol</dt>
          {/*
           * Rol davet anında sabitlendi
           * (`CompanyContactInvitationManager.java:50`): kullanıcı seçemiyor,
           * pazarlık edemiyor. Kabul etmeden önce hangi rolle katılacağını
           * görmesi gerekiyor.
           */}
          <dd>{contactRoleLabel(invitation.role)}</dd>
        </div>
        <div>
          <dt>Davet tarihi</dt>
          {/*
           * Davetin son kullanma tarihi yok ve iptal ucu da yok: aylar önce
           * gönderilmiş bir davet hâlâ `PENDING` ve kabul edilebilir.
           */}
          <dd>{invitation.invitedAt ? <InvitationTime value={invitation.invitedAt} /> : "—"}</dd>
        </div>
      </dl>

      {decision.kind === "answerable" ? (
        <InvitationDecisionForm action={action} companyName={invitation.company.name} />
      ) : null}

      {decision.kind === "notYours" ? <NotYoursNotice /> : null}

      {decision.kind === "answered" ? (
        <AnsweredNotice status={decision.status} answeredAt={invitation.answeredAt} />
      ) : null}
    </section>
  );
}

/**
 * Davet başkasının.
 *
 * Aksiyonlar hiç çizilmiyor: `answerToInvitation` bu hesabı kesin olarak
 * reddeder ve kullanıcı "Kabul et"e basıp 403 yerdi.
 */
function NotYoursNotice() {
  return (
    <div className="state-card" role="status">
      <h2>Bu davet sana ait değil</h2>
      <p>
        Davet başka bir hesaba gönderilmiş, bu yüzden buradan cevaplayamazsın. Daveti
        bekliyorsan davet edildiğin hesapla giriş yapman gerekiyor.
      </p>
      <Link className="text-link" href="/">
        Ana sayfaya dön
      </Link>
    </div>
  );
}

/** Cevaplanmış davet: karar geri alınamıyor, yeniden cevaplama ucu yok. */
function AnsweredNotice({ status, answeredAt }: { status: string; answeredAt: string | null }) {
  return (
    <div className="state-card" role="status">
      <h2>Bu davet cevaplanmış</h2>
      <p className="status-pill">{invitationStatusLabel(status)}</p>
      {answeredAt ? (
        <p>
          Cevaplanma tarihi: <InvitationTime value={answeredAt} />
        </p>
      ) : null}
      <p>Davet bir kez cevaplanıyor ve kararı geri almanın bir yolu yok.</p>
      <Link className="text-link" href="/">
        Ana sayfaya dön
      </Link>
    </div>
  );
}

function CompanyLogo({ invitation }: { invitation: CompanyContactInvitation }) {
  if (invitation.company.logoUrl) {
    return (
      <Image
        className="contact-avatar"
        src={invitation.company.logoUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
      />
    );
  }

  return (
    <div className="contact-avatar contact-avatar-placeholder" aria-hidden="true">
      {invitation.company.name[0] ?? "K"}
    </div>
  );
}

/**
 * Tarih `Instant`; saat dilimi açıkça İstanbul'a sabitleniyor ki sunucuda
 * ve tarayıcıda aynı metin üretilsin ve hidrasyon ayrışmasın.
 */
function InvitationTime({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{value}</>;

  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(date)}
    </time>
  );
}
