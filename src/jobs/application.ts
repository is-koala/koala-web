import { identityHandoffHref } from "@/identity/handoff";
import { workerApplicantAddressPath } from "@/lib/app-routes";

export type ApplicationRemedy = {
  readonly href: string;
  readonly label: string;
};

const identityRemedyLabel = "Kimlik doğrulamasını tamamla";

const remedies: Readonly<Record<string, ApplicationRemedy>> = {
  APPLICANT_ADDRESS_REQUIRED: {
    href: workerApplicantAddressPath,
    label: "Adresini ekle",
  },
  APPLICANT_BANK_ACCOUNT_REQUIRED: {
    href: "/panel/hesap#banka-hesaplari",
    label: "Ödeme hesabını ekle",
  },
};

export function applicationRemedy(
  errorCode: string,
  returnPath?: string | null,
): ApplicationRemedy | null {
  if (errorCode === "APPLICANT_IDENTITY_NOT_VERIFIED") {
    return { href: identityHandoffHref(returnPath), label: identityRemedyLabel };
  }
  return remedies[errorCode] ?? null;
}
