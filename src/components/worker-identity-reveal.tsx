"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { identityRevealErrors } from "@/assignments/errors";
import {
  identityRevealVisibleMs,
  idleIdentityRevealState,
  maskedIdentityValue,
  verificationMethodLabel,
  type IdentityRevealAction,
  type IdentityRevealState,
  type WorkerIdentity,
} from "@/assignments/identity-reveal";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { assignmentErrorMessage } from "@/components/assignment-error-message";
import { formatDateTime, formatJobDate } from "@/lib/dates";

/**
 * İşverenin sigorta bildirimi için işçinin kimlik bilgilerini görüntülediği
 * bölüm (is-koala/koala-web#185).
 *
 * Akış: düğme → onay diyaloğu ("görüntülemeniz kayda geçer ve çalışana
 * bildirilir") → server action → alanlar maskesiz → 60 sn sonra maskeli.
 * Bölümün çizilip çizilmeyeceğine çağıran karar veriyor
 * (`canRevealWorkerIdentity`); bileşen atama durumunu bilmiyor.
 *
 * Sonuç `useActionState`'te değil yerel durumda: `useActionState` son yanıtı
 * bir sonraki gönderime kadar tutar ve süre dolunca onu boşaltmanın yolu
 * yeni bir istek atmaktır. Burada action bir geçiş içinde doğrudan çağrılıyor
 * ve maske anında yanıt nesnesi durumdan düşüyor; ekranda da bellekte de
 * kalmıyor. Tarayıcı deposu yok, çerez yok, günlük yok
 * (`src/server/server-only.test.ts` bunu dört modülde zorluyor).
 *
 * Diyalog istek bitene kadar açık kalıyor (`dismissDisabled`): önce kapanıp
 * düğme de kapalı olsaydı odak `body`'ye düşerdi. Yanıt gelince diyalog
 * kapanır, odak yeniden açılan düğmeye döner ve canlı bölge sonucu okur.
 *
 * Maskeleme sonrası "Yeniden göster" aynı diyaloğu açıyor: her yeniden
 * görüntüleme backend'de yeni bir kayıt ve saatlik sınırdan bir hak.
 */

type RevealView = IdentityRevealState | { readonly status: "masked" };

export function WorkerIdentityReveal({
  workerName,
  action,
}: {
  workerName: string;
  action: IdentityRevealAction;
}) {
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<RevealView>(idleIdentityRevealState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (view.status !== "done") return;
    const timer = setTimeout(() => setView({ status: "masked" }), identityRevealVisibleMs);
    return () => clearTimeout(timer);
  }, [view]);

  function confirm() {
    startTransition(async () => {
      const next = await action(idleIdentityRevealState, new FormData());
      // `await` sonrası güncellemeler geçişe yeniden sarılıyor ki sonuç,
      // diyalogun kapanması ve `pending`'in düşmesi aynı çizimde olsun: diyalog
      // düğme hâlâ kapalıyken kapanırsa odak `body`'ye düşer.
      startTransition(() => {
        setView(next);
        setDialogOpen(false);
      });
    });
  }

  const masked = view.status === "masked";
  const identity = view.status === "done" ? view.identity : null;

  return (
    <section
      className="work-detail-section worker-identity"
      aria-labelledby="worker-identity-title"
      data-testid="worker-identity"
    >
      <h2 id="worker-identity-title">Çalışanın kimlik bilgileri</h2>
      <p className="muted">
        Sigorta bildirimi için {workerName} adlı çalışanın doğrulanmış kimlik bilgilerini
        görüntüleyebilirsiniz. Her görüntüleme kayda geçer ve çalışana bildirilir; bilgiler
        60 saniye sonra ekrandan kaldırılır.
      </p>

      {identity !== null || masked ? <IdentityFacts identity={identity} /> : null}

      {/*
        Canlı bölge her zaman belgede: içerik değişince okunuyor. Başarıda
        görsel olarak gizli (alanlar zaten ekranda), maskede görünür not.
      */}
      <p
        role="status"
        className={masked ? "muted worker-identity-masked-note" : "visually-hidden"}
        data-testid="worker-identity-status"
      >
        {identity !== null
          ? "Kimlik bilgileri görüntülendi."
          : masked
            ? "Süre doldu; bilgiler ekrandan kaldırıldı. Gerekirse yeniden görüntüleyebilirsiniz."
            : null}
      </p>

      {view.status === "error" ? (
        <p role="alert" className="form-warning">
          {assignmentErrorMessage(view.errorCode, view.httpStatus, revealSentences)}
        </p>
      ) : null}

      <div className="worker-identity-actions">
        <button
          ref={triggerRef}
          type="button"
          className="button button-secondary button-small"
          disabled={pending}
          onClick={() => setDialogOpen(true)}
        >
          {masked ? "Yeniden göster (sigorta için)" : "Kimlik bilgilerini göster (sigorta için)"}
        </button>
      </div>

      {dialogOpen ? (
        <AccessibleDialog
          labelledBy={titleId}
          dismissDisabled={pending}
          returnFocus={triggerRef}
          onDismiss={() => setDialogOpen(false)}
        >
          <section className="assignment-dialog">
            <p className="eyebrow">Son kontrol</p>
            <h2 id={titleId}>Kimlik bilgilerini görüntüle</h2>
            <p>
              Görüntülemeniz kayda geçer ve çalışana bildirilir. Bilgiler yalnız sigorta
              bildirimi için kullanılmalı; 60 saniye sonra ekrandan kaldırılır.
            </p>
            {/*
              "Vazgeç" önde: diyalog açılınca odak ilk düğmeye gidiyor ve
              kayda geçen bir eylemde Enter'ın varsayılanı vazgeçmek olmalı.
            */}
            <div className="assignment-dialog-actions">
              <button
                className="button button-secondary button-small"
                type="button"
                disabled={pending}
                onClick={() => setDialogOpen(false)}
              >
                Vazgeç
              </button>
              <button
                className="button button-primary button-small"
                type="button"
                disabled={pending}
                onClick={confirm}
              >
                {pending ? "Kimlik bilgileri alınıyor" : "Görüntülemeyi onayla"}
              </button>
            </div>
          </section>
        </AccessibleDialog>
      ) : null}
    </section>
  );
}

/**
 * Alanlar tek `<dl>`. Maskeli hâlde (`identity` null) değerlerin yerine sabit
 * nokta dizisi; açık hâlde boş gelen alan "—" — ikisi görsel olarak ayrı, boş
 * alan maskelenmiş sanılmasın.
 */
function IdentityFacts({ identity }: { identity: WorkerIdentity | null }) {
  const masked = identity === null;
  const value = (text: string | null | undefined) => (masked ? maskedIdentityValue : text || "—");
  return (
    <dl
      className="assignment-detail-facts worker-identity-facts"
      aria-label="Kimlik bilgileri"
      data-masked={masked ? "true" : undefined}
    >
      <div>
        <dt>Ad soyad</dt>
        <dd>{value(identity?.fullName)}</dd>
      </div>
      <div>
        <dt>T.C. kimlik numarası</dt>
        <dd className="worker-identity-number">
          <span data-testid="worker-identity-number">{value(identity?.tcIdentityNumber)}</span>
          {identity?.tcIdentityNumber ? <CopyButton value={identity.tcIdentityNumber} /> : null}
        </dd>
      </div>
      <div>
        <dt>Doğum tarihi</dt>
        <dd>{value(identity?.birthDate ? formatJobDate(identity.birthDate) : null)}</dd>
      </div>
      <div>
        <dt>Doğrulama</dt>
        <dd>
          {value(
            identity
              ? [
                  verificationMethodLabel(identity.verificationMethod),
                  identity.verifiedAt ? formatDateTime(identity.verifiedAt) : null,
                ].filter(Boolean).join(" · ")
              : null,
          )}
        </dd>
      </div>
    </dl>
  );
}

/**
 * TCKN'yi panoya kopyalar.
 *
 * Pano yazımı başarısız olursa (izin yok, güvensiz bağlam) düğme sessizce
 * "kopyalanamadı" der; hata da değer de hiçbir yere yazılmıyor.
 */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <button type="button" className="button button-secondary button-small" onClick={() => void copy()}>
      {copied === "done" ? "Kopyalandı" : copied === "failed" ? "Kopyalanamadı" : "Kopyala"}
    </button>
  );
}

/** Bölümün kendi iki cümlesi; kataloğun `title`/`action`'ı burada okunmuyor. */
const revealSentences: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(identityRevealErrors).map(([code, presentation]) => [code, presentation.message]),
);
