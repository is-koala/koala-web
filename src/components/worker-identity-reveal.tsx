"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";

import { assignmentNotFoundMessage } from "@/assignments/contract";
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
import { formatDateTime, formatJobDate } from "@/lib/dates";
import { errorPresentation } from "@/lib/errors";

/**
 * İşverenin sigorta bildirimi için işçinin kimlik bilgilerini görüntülediği
 * bölüm (is-koala/koala-web#185).
 *
 * Akış: düğme → onay diyaloğu ("görüntülemeniz kayda geçer ve çalışana
 * bildirilir") → server action → alanlar maskesiz → 60 sn sonra maskeli.
 * Bölümün çizilip çizilmeyeceğine çağıran karar veriyor
 * (`canRevealWorkerIdentity`); bileşen atama durumunu bilmiyor.
 *
 * Değer yalnız action durumunda ve bu bileşenin yerel durumunda yaşıyor:
 * tarayıcı deposu yok, çerez yok, günlük yok; sayfa yenilenince gidiyor
 * (`src/server/server-only.test.ts` bunu dört modülde zorluyor).
 * Zamanlayıcı `useEffect` temizliğinde iptal ediliyor; bileşen ekrandan
 * kalkınca (gezinme, kabuk değişimi) süre dolmasını beklemiyor.
 *
 * Maskeleme sonrası "Yeniden göster" aynı diyaloğu açıyor: her yeniden
 * görüntüleme backend'de yeni bir kayıt ve saatlik sınırdan bir hak.
 */
export function WorkerIdentityReveal({
  workerName,
  action,
}: {
  workerName: string;
  action: IdentityRevealAction;
}) {
  const [state, dispatch, pending] = useActionState(action, idleIdentityRevealState);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Süresi dolan yanıtın kendisi tutuluyor, bir bayrak değil: her başarılı
  // yanıt yeni bir durum nesnesi, yani ikinci görüntüleme ilk çizimde bile
  // maskesiz başlıyor ve süre yeniden sayılıyor.
  const [expired, setExpired] = useState<IdentityRevealState | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (state.status !== "done") return;
    const timer = setTimeout(() => setExpired(state), identityRevealVisibleMs);
    return () => clearTimeout(timer);
  }, [state]);

  function confirm() {
    setDialogOpen(false);
    startTransition(() => dispatch(new FormData()));
  }

  const revealed = state.status === "done";
  const masked = revealed && expired === state;
  const visible = revealed && !masked ? state.identity : null;

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

      {revealed ? (
        <IdentityFacts identity={visible} masked={masked} />
      ) : null}
      {masked ? (
        <p role="status" className="muted worker-identity-masked-note">
          Süre doldu; bilgiler ekrandan kaldırıldı. Gerekirse yeniden görüntüleyebilirsiniz.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="form-warning">
          {revealErrorMessage(state.errorCode, state.httpStatus)}
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
          {pending
            ? "Kimlik bilgileri alınıyor"
            : masked
              ? "Yeniden göster (sigorta için)"
              : "Kimlik bilgilerini göster (sigorta için)"}
        </button>
      </div>

      {dialogOpen ? (
        <AccessibleDialog
          labelledBy={titleId}
          dismissDisabled={false}
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
                onClick={() => setDialogOpen(false)}
              >
                Vazgeç
              </button>
              <button
                className="button button-primary button-small"
                type="button"
                onClick={confirm}
              >
                Görüntülemeyi onayla
              </button>
            </div>
          </section>
        </AccessibleDialog>
      ) : null}
    </section>
  );
}

/**
 * Alanlar tek `<dl>`; maskeli hâlde değerlerin yerine sabit nokta dizisi.
 *
 * Maskeli görünüm gerçek değerden türetilmiyor: `identity` `null` olunca
 * ekranda bilgiden bir iz kalmıyor, yalnız satır başlıkları.
 */
function IdentityFacts({ identity, masked }: { identity: WorkerIdentity | null; masked: boolean }) {
  return (
    <dl
      className="assignment-detail-facts worker-identity-facts"
      aria-label="Kimlik bilgileri"
      data-masked={masked ? "true" : undefined}
    >
      <div>
        <dt>Ad soyad</dt>
        <dd>{identity?.fullName || maskedIdentityValue}</dd>
      </div>
      <div>
        <dt>T.C. kimlik numarası</dt>
        <dd className="worker-identity-number">
          <span data-testid="worker-identity-number">
            {identity?.tcIdentityNumber || maskedIdentityValue}
          </span>
          {identity?.tcIdentityNumber ? <CopyButton value={identity.tcIdentityNumber} /> : null}
        </dd>
      </div>
      <div>
        <dt>Doğum tarihi</dt>
        <dd>{identity?.birthDate ? formatJobDate(identity.birthDate) : maskedIdentityValue}</dd>
      </div>
      <div>
        <dt>Doğrulama</dt>
        <dd>
          {identity
            ? [
                verificationMethodLabel(identity.verificationMethod),
                identity.verifiedAt ? formatDateTime(identity.verifiedAt) : null,
              ].filter(Boolean).join(" · ")
            : maskedIdentityValue}
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
    <button
      type="button"
      className="button button-secondary button-small worker-identity-copy"
      onClick={() => void copy()}
    >
      {copied === "done" ? "Kopyalandı" : copied === "failed" ? "Kopyalanamadı" : "Kopyala"}
    </button>
  );
}

/**
 * Bölümün üç reddi kendi kataloğundan (`identityRevealErrors`), 404 öbür
 * atama eylemleriyle aynı cümleden, gerisi kabuk kataloğundan.
 */
function revealErrorMessage(errorCode: string, httpStatus: number): string {
  const own = identityRevealErrors[errorCode];
  if (own) return own.message;
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND" || httpStatus === 404) return assignmentNotFoundMessage;
  return errorPresentation(errorCode, httpStatus).message;
}
