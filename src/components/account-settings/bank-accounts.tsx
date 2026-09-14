import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { FieldError, FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { fieldError } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";
import type { BankAccount, IbanVerification } from "@/server/account-settings/settings";

import { ResourceAction } from "./action-controls";
import { formatAccountDate } from "./presentation";
import { initialSettingsActionState } from "./types";

/**
 * Banka hesapları: liste, IBAN ekleme ve sahiplik doğrulaması.
 *
 * İki adreste çiziliyor — hesap ayarları ve `/panel/kazanclarim`. Ödeme
 * çıkışı birincil ve **doğrulanmış** hesaba gidiyor; doğrulama transferinin
 * talimatı bu yüzden kazanç sayfasında da okunabilmeli.
 */
export function BankAccounts({
  accounts,
  addAction,
  selectPrimaryAction,
  verifyAction,
  deleteAction,
  intro = "Ödemeler birincil hesabına yönlendirilir.",
}: {
  accounts: readonly BankAccount[];
  addAction: SettingsAction;
  selectPrimaryAction: SettingsAction;
  verifyAction: SettingsAction;
  deleteAction: SettingsAction;
  intro?: string;
}) {
  const [state, submit] = useActionState(addAction, initialSettingsActionState);

  return (
    <section
      className="settings-card"
      id="banka-hesaplari"
      aria-labelledby="banka-hesaplari-baslik"
    >
      <div className="settings-heading">
        <div>
          <h2 id="banka-hesaplari-baslik">Banka hesapları</h2>
          <p>{intro}</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="settings-empty">Henüz banka hesabın yok.</p>
      ) : (
        <ul className="settings-list">
          {accounts.map((account) => (
            <BankAccountRow
              key={account.id}
              account={account}
              selectPrimaryAction={selectPrimaryAction}
              verifyAction={verifyAction}
              deleteAction={deleteAction}
            />
          ))}
        </ul>
      )}

      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        {state.status === "done" ? (
          <p className="inline-success" role="status" aria-label="Banka hesabı sonucu">
            Banka hesabın eklendi.
          </p>
        ) : null}
        <TextField
          name="iban"
          label="IBAN"
          autoComplete="off"
          maxLength={34}
          hint="TR ile başlayan 26 haneli IBAN'ını gir. Kaydettikten sonra yalnız maskeli hâli görünür."
          error={fieldError(state, "iban")}
        />
        <SubmitButton label="Hesap ekle" pendingLabel="Ekleniyor…" />
      </form>
    </section>
  );
}

function BankAccountRow({
  account,
  selectPrimaryAction,
  verifyAction,
  deleteAction,
}: {
  account: BankAccount;
  selectPrimaryAction: SettingsAction;
  verifyAction: SettingsAction;
  deleteAction: SettingsAction;
}) {
  return (
    <li className="settings-list-item bank-account-item">
      <div className="bank-account-main">
        <strong className="masked-value">{account.maskedIban}</strong>
        <div className="status-row">
          {account.primary ? <span className="status-pill">Birincil hesap</span> : null}
          <span className="muted">{bankVerificationLabel(account.verificationStatus)}</span>
        </div>
        {canStartVerification(account.verificationStatus) ? (
          <VerificationStarter account={account} action={verifyAction} />
        ) : null}
      </div>
      <div className="compact-actions">
        {!account.primary ? (
          <ResourceAction
            action={selectPrimaryAction}
            field="accountId"
            value={account.id}
            label="Birincil yap"
            pendingLabel="Seçiliyor…"
          />
        ) : null}
        <ResourceAction
          action={deleteAction}
          field="accountId"
          value={account.id}
          label="Sil"
          pendingLabel="Siliniyor…"
          secondary
        />
      </div>
    </li>
  );
}

/**
 * Doğrulama transferini başlatır ve talimatı satırın altında bırakır.
 *
 * `PENDING` hesapta da düğme var: backend bekleyen doğrulama için aynı tutar
 * ve referansı yeniden döndürüyor, yani kullanıcı talimatı kaybettiyse
 * yeniden okuyabilir. `VERIFIED` hesapta düğme yok — 409 ile reddedilir.
 */
function VerificationStarter({ account, action }: { account: BankAccount; action: SettingsAction }) {
  const [state, submit] = useActionState(action, initialSettingsActionState);

  if (state.status === "done" && state.ibanVerification) {
    return <VerificationInstructions verification={state.ibanVerification} />;
  }

  return (
    <form className="compact-form verification-starter" action={submit}>
      <FormAlert state={state} />
      <FieldError message={fieldError(state, "accountId")} />
      <input type="hidden" name="accountId" value={account.id} readOnly />
      <VerifyButton
        label={account.verificationStatus === "PENDING" ? "Transfer talimatını göster" : "IBAN'ı doğrula"}
      />
    </form>
  );
}

function VerifyButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-small button-secondary" type="submit" disabled={pending}>
      {pending ? "Hazırlanıyor…" : label}
    </button>
  );
}

function VerificationInstructions({ verification }: { verification: IbanVerification }) {
  return (
    <div className="verification-instructions" role="status" aria-label="IBAN doğrulama talimatı">
      <h3>Sahipliğini doğrulamak için küçük bir transfer yap</h3>
      <p>
        {verification.maskedIban} hesabından aşağıdaki tutarı, açıklamaya referansı yazarak gönder.
        Gönderen IBAN kayıtlı IBAN&apos;la eşleşmezse doğrulama geçmez.
      </p>
      <dl className="verification-facts">
        <div>
          <dt>Tutar</dt>
          <dd>{formatMoney(verification.amount, verification.currency)}</dd>
        </div>
        <div>
          <dt>Açıklama / referans</dt>
          <dd><code>{verification.reference}</code></dd>
        </div>
        <div>
          <dt>Alıcı IBAN</dt>
          <dd><code>{verification.targetIban}</code></dd>
        </div>
        {verification.expiresAt ? (
          <div>
            <dt>Son gün</dt>
            <dd>{formatAccountDate(verification.expiresAt)}</dd>
          </div>
        ) : null}
        {verification.attemptsLeft !== null ? (
          <div>
            <dt>Kalan deneme</dt>
            <dd>{verification.attemptsLeft}</dd>
          </div>
        ) : null}
      </dl>
      <p className="muted">Transfer bize ulaştığında hesabın doğrulanmış olarak işaretlenir.</p>
    </div>
  );
}

function canStartVerification(status: string): boolean {
  return status === "UNVERIFIED" || status === "EXPIRED" || status === "PENDING";
}

function bankVerificationLabel(status: string): string {
  if (status === "VERIFIED") return "Doğrulandı";
  if (status === "PENDING") return "Doğrulama bekliyor";
  if (status === "REJECTED") return "Doğrulanamadı";
  if (status === "UNVERIFIED") return "Doğrulanmadı";
  if (status === "EXPIRED") return "Doğrulama süresi doldu";
  return "Doğrulama durumu bilinmiyor";
}
