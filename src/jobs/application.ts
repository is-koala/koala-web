import { workerApplicantAddressPath } from "@/lib/app-routes";

export type ApplicationRemedy = {
  readonly href: string;
  readonly label: string;
};

const remedies: Readonly<Record<string, ApplicationRemedy>> = {
  APPLICANT_IDENTITY_NOT_VERIFIED: {
    href: "/uygulamayi-ac",
    label: "Kimlik doğrulamasını tamamla",
  },
  APPLICANT_ADDRESS_REQUIRED: {
    href: workerApplicantAddressPath,
    label: "Adresini ekle",
  },
  APPLICANT_BANK_ACCOUNT_REQUIRED: {
    href: "/panel/hesap#banka-hesaplari",
    label: "Ödeme hesabını ekle",
  },
};

export function applicationRemedy(errorCode: string): ApplicationRemedy | null {
  return remedies[errorCode] ?? null;
}
