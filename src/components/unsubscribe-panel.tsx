"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";

import { ErrorCard } from "@/components/error-card";
import { DoneNotice } from "@/components/form-controls";
import { PublicErrorState } from "@/components/public-states";
import { FactList } from "@/components/ui/list-row";
import { unsubscribeContent, unsubscribeLinkProblems } from "@/content/unsubscribe";
import { loadBackendErrorFamilies } from "@/lib/backend-error-families";
import { notificationCategoryLabel, notificationChannelLabel } from "@/lib/notification-labels";
import { notificationPreferencesEntryPath } from "@/lib/notification-routes";
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
  // Açılışta çizilen kart odağı çalmaz; yalnız onaydan dönen sonuç odağı alır.
  if (search !== null && token === null) return <LinkProblem kind="invalid" focusOnMount={false} />;
  if (outcome?.outcome === "expired" || outcome?.outcome === "invalid") {
    return <LinkProblem kind={outcome.outcome} focusOnMount />;
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
      {/* Token okunana kadar kapalı: statik HTML'de ve hidrasyondan önce
          düğmenin eylemi React'in yer tutucusu, basılsa dokunuş kaybolurdu. */}
      <button className="button button-primary" type="submit" disabled={pending || token === null}>
        {pending ? unsubscribeContent.pendingLabel : unsubscribeContent.confirmLabel}
      </button>
      {outcome?.outcome === "failed" ? <ManagePreferences className="muted" /> : null}
      <p className="trust-note">{unsubscribeContent.confirmNote}</p>
    </form>
  );
}

async function sendUnsubscribe(
  _previous: UnsubscribeOutcome | null,
  token: string,
): Promise<UnsubscribeOutcome> {
  // Ret katalogda olmayan bir kodla gelirse kart bir parça beklemesin
  // (is-koala/koala-web#184); `PublicFormAlert` gönderimde aynısını yapıyor.
  void loadBackendErrorFamilies();
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
  const result = useResultFocus(true);
  const facts = [
    outcome.category
      ? { term: unsubscribeContent.categoryTerm, detail: notificationCategoryLabel(outcome.category) }
      : null,
    outcome.channel
      ? { term: unsubscribeContent.channelTerm, detail: notificationChannelLabel(outcome.channel) }
      : null,
  ];
  return (
    <div className="unsubscribe-outcome" ref={result}>
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

function LinkProblem({
  kind,
  focusOnMount,
}: {
  kind: keyof typeof unsubscribeLinkProblems;
  focusOnMount: boolean;
}) {
  const result = useResultFocus(focusOnMount);
  return (
    <div className="unsubscribe-outcome" ref={result}>
      <ErrorCard presentation={unsubscribeLinkProblems[kind]} />
      <ManagePreferences />
    </div>
  );
}

/**
 * Sonuç formun yerini alıyor: düğme kaybolunca odak `<body>`'ye düşer ve
 * içeriğiyle birlikte eklenen `role="status"` her ekran okuyucuda
 * duyurulmuyor. Odak sonucun başlığına taşınır; başlık okunur ve klavye
 * kullanıcısı yerinde kalır.
 */
function useResultFocus(enabled: boolean) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const heading = container.current?.querySelector<HTMLElement>("h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [enabled]);
  return container;
}

/**
 * Hesap ayarları iki kabukta ayrı adreste (`/panel/hesap`, `/isveren/hesap`)
 * ve bağlantı rolü bilmiyor. `/hesap/bildirimler` rolü sunucuda çözüp
 * kullanıcıyı kendi kabuğundaki tercihlere bırakıyor; oturum yoksa girişe
 * gönderip oraya döndürüyor.
 */
function ManagePreferences({ className = "trust-note" }: { className?: string }) {
  return (
    <p className={className}>
      {unsubscribeContent.manageBody}{" "}
      <Link className="text-link" href={notificationPreferencesEntryPath}>
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
