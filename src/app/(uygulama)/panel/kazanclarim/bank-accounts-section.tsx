"use client";

import {
  addBankAccountAction,
  deleteBankAccountAction,
  selectPrimaryBankAccountAction,
  startBankAccountVerificationAction,
} from "@/app/(uygulama)/hesap-actions";
import { BankAccounts } from "@/components/account-settings/bank-accounts";
import type { BankAccount } from "@/server/account-settings/settings";

/**
 * Kazanç sayfasının istemci sınırı: hesap ayarlarındaki banka kartının aynısı,
 * aynı action'larla. Ödeme çıkışı doğrulanmış birincil hesaba gittiği için
 * IBAN ekleme ve doğrulama talimatı kazançların yanında da durmalı.
 */
export function BankAccountsSection({ accounts }: { accounts: readonly BankAccount[] }) {
  return (
    <BankAccounts
      accounts={accounts}
      addAction={addBankAccountAction}
      selectPrimaryAction={selectPrimaryBankAccountAction}
      verifyAction={startBankAccountVerificationAction}
      deleteAction={deleteBankAccountAction}
      intro="Ödeme çıkışları doğrulanmış birincil hesabına yapılır. IBAN'ını ekle ve küçük bir transferle sahipliğini doğrula."
    />
  );
}
