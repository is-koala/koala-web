"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import { SubmitButton, TextField } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import {
  Card,
  FactList,
  ListRow,
  ListRows,
  PageHeader,
  PagePanel,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { accountSessionsHref, type AppShellId } from "@/lib/app-routes";
import { fieldError, idleFormState, type FormAction, type FormState } from "@/lib/form-state";
import {
  deviceNameMaxLength,
  loginHistorySize,
  type LoginHistoryEntry,
  type SessionDetail,
} from "@/lib/session-detail";

import { deviceTypeLabel, formatAccountDate, sessionLocationLabel } from "./presentation";

/**
 * Oturum ayrıntısı (is-koala/koala-web#188): cihaz, IP, konum, zamanlar,
 * giriş geçmişi; cihazı adlandırma ve oturumu kapatma.
 *
 * İki eylem de kendi formunda ve kendi `useActionState`'inde: adlandırma
 * sayfada kalır ve başarıyı satır içinde söyler, kapatma ise listeye
 * yönlendirir — cevabı aynı durumda tutmak birinin hatasını öbürünün
 * formuna yazdırırdı.
 */
export function SessionDetailScreen({
  shell,
  detail,
  renameAction,
  revokeAction,
}: {
  shell: AppShellId;
  detail: SessionDetail;
  renameAction: FormAction;
  revokeAction: FormAction;
}) {
  // Adlandırma başarılı olunca sunucu sayfayı tazeliyor; o gelene kadar
  // başlık yeni adı buradan okur.
  const [renamedTo, setRenamedTo] = useState<string | null>(null);
  const deviceName = renamedTo ?? detail.deviceName ?? deviceTypeLabel(detail.deviceType);

  return (
    <PagePanel className="session-detail" aria-labelledby="oturum-baslik">
      <p className="session-detail-back">
        <Link className="text-link" href={accountSessionsHref(shell)}>
          ← Oturumlar ve cihazlar
        </Link>
      </p>
      <PageHeader
        eyebrow="Oturum"
        title={
          <span className="session-detail-title">
            {deviceName}
            {detail.current ? <StatusBadge tone="success">Bu cihaz</StatusBadge> : null}
          </span>
        }
        titleId="oturum-baslik"
        lede={deviceTypeLabel(detail.deviceType)}
      />

      <Card as="section" aria-labelledby="oturum-bilgi-baslik">
        <SectionHeader title="Oturum bilgileri" titleId="oturum-bilgi-baslik" />
        <FactList
          facts={[
            { term: "IP adresi", detail: detail.ipAddress ?? "—" },
            { term: "Konum", detail: sessionLocationLabel(detail.location) },
            { term: "Oluşturulma", detail: formatAccountDate(detail.createdAt) },
            { term: "Son erişim", detail: formatAccountDate(detail.lastAccessedAt) },
            { term: "Süre sonu", detail: formatAccountDate(detail.refreshExpiresAt) },
            { term: "Toplam giriş", detail: String(detail.logins) },
          ]}
        />
      </Card>

      <RenameDeviceForm detail={detail} action={renameAction} onRenamed={setRenamedTo} />

      <Card as="section" aria-labelledby="giris-gecmisi-baslik">
        <SectionHeader
          title="Giriş geçmişi"
          titleId="giris-gecmisi-baslik"
          description={`Bu cihazdan yapılan son ${loginHistorySize} giriş denemesi.`}
        />
        <LoginHistory entries={detail.loginHistory} />
      </Card>

      <Card as="section" tone="sunken" aria-labelledby="oturum-kapat-baslik">
        <SectionHeader
          title="Oturumu kapat"
          titleId="oturum-kapat-baslik"
          description={
            detail.current
              ? "Bu, şu an kullandığın oturum; kapatmak çıkış yapmak demek."
              : "Bu cihazdaki oturum sonlanır; tekrar giriş yapması gerekir."
          }
        />
        {detail.current ? (
          <Link className="button button-secondary" href="/cikis">
            Bu cihazdan çıkış yap
          </Link>
        ) : (
          <RevokeSessionForm sessionId={detail.id} action={revokeAction} />
        )}
      </Card>
    </PagePanel>
  );
}

/**
 * Form `action={submit}` ile değil `onSubmit` + `startTransition` ile
 * gönderiliyor: React 19 `<form action>` gönderim biter bitmez formu koşulsuz
 * sıfırlıyor, hata döndüğünde de — 404'te yazılan ad siliniyordu (ölçüldü).
 * Ad bu yüzden durumda: hata sonrası olduğu gibi kalıyor, başarıda başlık
 * sunucu sayfayı yeniden çizene kadar yeni adı buradan okuyor.
 */
function RenameDeviceForm({
  detail,
  action,
  onRenamed,
}: {
  detail: SessionDetail;
  action: FormAction;
  onRenamed: (name: string) => void;
}) {
  const [state, dispatch, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.status === "done") onRenamed(String(formData.get("name") ?? "").trim());
      return next;
    },
    idleFormState,
  );
  const [name, setName] = useState(detail.deviceCustomName ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <Card as="section" aria-labelledby="cihaz-adi-baslik">
      <SectionHeader
        title="Cihazı adlandır"
        titleId="cihaz-adi-baslik"
        description="Listede tanımanı kolaylaştıracak bir ad ver, örneğin “Evdeki iPad”."
      />
      <form className="form settings-form" onSubmit={submit}>
        <FormAlert state={state} />
        {state.status === "done" ? (
          <p className="inline-success" role="status">
            Cihaz adı güncellendi.
          </p>
        ) : null}
        <input type="hidden" name="sessionId" value={detail.id} readOnly />
        <input type="hidden" name="deviceId" value={detail.deviceId} readOnly />
        <TextField
          name="name"
          label="Cihaz adı"
          autoComplete="off"
          value={name}
          onValueChange={setName}
          maxLength={deviceNameMaxLength}
          hint={`En fazla ${deviceNameMaxLength} karakter.`}
          error={fieldError(state, "name")}
        />
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Cihazı adlandır"}
        </button>
      </form>
    </Card>
  );
}

function RevokeSessionForm({
  sessionId,
  action,
}: {
  sessionId: string;
  action: FormAction;
}) {
  const [state, submit] = useActionState(action, idleFormState);
  return (
    <form className="compact-form" action={submit}>
      <FormAlert state={state} />
      <input type="hidden" name="sessionId" value={sessionId} readOnly />
      <SubmitButton label="Oturumu kapat" pendingLabel="Kapatılıyor…" />
    </form>
  );
}

/**
 * Boş liste bir hata değil: geçmiş backend 0.9.28 ile tutulmaya başladı ve
 * ondan önceki girişler yok. Not bu yüzden ilk kez boş listede duruyor;
 * kullanıcı "hiç giriş yapmadım mı?" diye düşünmemeli.
 */
function LoginHistory({ entries }: { entries: readonly LoginHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="settings-empty">
        Henüz kayıtlı giriş yok. Geçmiş, güncellemeden sonraki girişleri kapsar.
      </p>
    );
  }
  return (
    <ListRows aria-label="Giriş denemeleri">
      {entries.map((entry, index) => (
        <ListRow
          key={`${entry.at ?? "zaman-yok"}-${index}`}
          title={formatAccountDate(entry.at)}
          meta={`${entry.ipAddress ?? "—"} · ${sessionLocationLabel(entry.location)}`}
          trailing={
            entry.success ? (
              <StatusBadge tone="success">Başarılı</StatusBadge>
            ) : (
              <StatusBadge tone="danger">Başarısız</StatusBadge>
            )
          }
        />
      ))}
    </ListRows>
  );
}
