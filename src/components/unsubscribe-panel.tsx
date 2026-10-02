"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";

import { ErrorCard } from "@/components/error-card";
import { DoneNotice } from "@/components/form-controls";
import { PublicErrorState } from "@/components/public-states";
import { FactList } from "@/components/ui/list-row";
import { unsubscribeContent, unsubscribeLinkProblems } from "@/content/unsubscribe";
import { loginPath } from "@/lib/login-path";
import { notificationCategoryLabel, notificationChannelLabel } from "@/lib/notification-labels";
import {
  unsubscribeEndpoint,
  unsubscribeOutcomeFrom,
  unsubscribeTokenFrom,
  type UnsubscribeOutcome,
} from "@/notifications/unsubscribe";

/**
 * Çıkış bağlantısının onay paneli.
 *
 * Token sunucuda hiç okunmuyor: sayfa statik üretiliyor ve token yalnız
 * kullanıcı onayladığında adres çubuğundan okunup BFF'ye POST gövdesinde
 * gidiyor. Sayfa istek başına çizilseydi Next adresin sorgu dizisini RSC
 * yüküne (`c`, `q`) yazardı; token o zaman HTML'e de girerdi
 * (`tests/e2e/unsubscribe-production.spec.ts`). DOM'a, gizli alana ya da bir
 * log satırına hiç yazılmıyor.
 */
export function UnsubscribePanel() {
  // Statik HTML'de adres bilinmiyor (`null`); hidrasyondan sonra okunur.
  const search = useSyncExternalStore(subscribeToNothing, currentSearch, unknownSearch);
  const [outcome, confirm, pending] = useActionState(sendUnsubscribe, null);

  const token = search === null ? null : unsubscribeTokenFrom(search);
  if (search !== null && token === null) return <LinkProblem kind="invalid" />;
  if (outcome?.outcome === "expired" || outcome?.outcome === "invalid") {
    return <LinkProblem kind={outcome.outcome} />;
  }
  if (outcome?.outcome === "unsubscribed") return <Unsubscribed outcome={outcome} />;

  return (
    <form
      className="form"
      action={() => {
        if (token) confirm(token);
      }}
    >
      {outcome?.outcome === "failed" ? (
        <PublicErrorState errorCode={outcome.errorCode} status={outcome.httpStatus} />
      ) : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? unsubscribeContent.pendingLabel : unsubscribeContent.confirmLabel}
      </button>
      <p className="trust-note">{unsubscribeContent.confirmNote}</p>
    </form>
  );
}

async function sendUnsubscribe(
  _previous: UnsubscribeOutcome | null,
  token: string,
): Promise<UnsubscribeOutcome> {
  try {
    const response = await fetch(unsubscribeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    return unsubscribeOutcomeFrom(response.status, await response.json().catch(() => null));
  } catch {
    // Ağ hatası başarı sayılmaz; metin kodsuz yedekten gelir.
    return unsubscribeOutcomeFrom(0, null);
  }
}

function Unsubscribed({
  outcome,
}: {
  outcome: Extract<UnsubscribeOutcome, { outcome: "unsubscribed" }>;
}) {
  const facts = [
    outcome.category
      ? { term: unsubscribeContent.categoryTerm, detail: notificationCategoryLabel(outcome.category) }
      : null,
    outcome.channel
      ? { term: unsubscribeContent.channelTerm, detail: notificationChannelLabel(outcome.channel) }
      : null,
  ];
  return (
    <div className="unsubscribe-outcome">
      <DoneNotice
        title={outcome.alreadyDisabled ? unsubscribeContent.alreadyTitle : unsubscribeContent.doneTitle}
      >
        <p>{outcome.alreadyDisabled ? unsubscribeContent.alreadyBody : unsubscribeContent.doneBody}</p>
        <FactList facts={facts} columns={2} />
      </DoneNotice>
      <ManagePreferences />
    </div>
  );
}

function LinkProblem({ kind }: { kind: keyof typeof unsubscribeLinkProblems }) {
  return (
    <div className="unsubscribe-outcome">
      <ErrorCard presentation={unsubscribeLinkProblems[kind]} />
      <ManagePreferences />
    </div>
  );
}

/**
 * Hesap ayarları iki kabukta ayrı adreste (`/panel/hesap`, `/isveren/hesap`)
 * ve bağlantı rolü bilmiyor; giriş, rolü okuyup kullanıcıyı kendi kabuğuna
 * bırakıyor (`postLoginDestination`).
 */
function ManagePreferences() {
  return (
    <p className="trust-note">
      {unsubscribeContent.manageBody}{" "}
      <Link className="text-link" href={loginPath}>
        {unsubscribeContent.manageAction}
      </Link>
    </p>
  );
}

function subscribeToNothing() {
  return () => {};
}

function currentSearch(): string {
  return window.location.search;
}

function unknownSearch(): null {
  return null;
}
