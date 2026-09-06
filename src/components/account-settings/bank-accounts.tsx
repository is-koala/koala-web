import { useActionState } from "react";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { fieldError } from "@/lib/form-state";
import type { BankAccount } from "@/server/account-settings/settings";

import { ResourceAction } from "./action-controls";
import { initialSettingsActionState } from "./types";

export function BankAccounts({
  accounts,
  addAction,
  selectPrimaryAction,
  deleteAction,
}: {
  accounts: readonly BankAccount[];
  addAction: SettingsAction;
  selectPrimaryAction: SettingsAction;
  deleteAction: SettingsAction;
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
          <p>Ödemeler birincil hesabına yönlendirilir.</p>
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
  deleteAction,
}: {
  account: BankAccount;
  selectPrimaryAction: SettingsAction;
  deleteAction: SettingsAction;
}) {
  return (
    <li className="settings-list-item">
      <div>
        <strong className="masked-value">{account.maskedIban}</strong>
        <div className="status-row">
          {account.primary ? <span className="status-pill">Birincil hesap</span> : null}
          <span className="muted">{bankVerificationLabel(account.verificationStatus)}</span>
        </div>
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

function bankVerificationLabel(status: string): string {
  if (status === "VERIFIED") return "Doğrulandı";
  if (status === "PENDING") return "Doğrulama bekliyor";
  if (status === "REJECTED") return "Doğrulanamadı";
  if (status === "UNVERIFIED") return "Doğrulanmadı";
  if (status === "EXPIRED") return "Doğrulama süresi doldu";
  return "Doğrulama durumu bilinmiyor";
}
