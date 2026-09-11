import { beforeEach, expect, it, vi } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";
import type { ViewerGates } from "@/server/session/gates";

const readEmployerPaymentCompany = vi.hoisted(() => vi.fn());
vi.mock("./payments", () => ({ readEmployerPaymentCompany }));

import { readEmployerPaymentRequirements } from "./preflight";

const assignment = {
  employerType: "INDIVIDUAL",
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
} as EmployerAssignment;
const gates = {
  individualJob: { open: true },
  companyCreation: { open: true },
  application: { open: true },
  individualPayment: {
    open: false,
    blockedBy: ["identityNumber", "individualBillingAddress"],
  },
  companies: [{
    companyId: "company-1",
    companyName: "Koala A.Ş.",
    role: "ADMIN",
    approved: true,
    corporateJob: { open: true },
  }],
  unmet: ["identityNumber", "individualBillingAddress"],
} satisfies ViewerGates;

beforeEach(() => vi.clearAllMocks());

it("bireysel ödeme kapısında advisory ve blocking kiplerini korur", async () => {
  await expect(readEmployerPaymentRequirements(gates, assignment)).resolves.toEqual({
    advisories: ["individualBillingAddress"],
    blocked: ["identityNumber"],
  });
  expect(readEmployerPaymentCompany).not.toHaveBeenCalled();
});

it("şirket ödemesinde yetkiyi ve şirket adresini merkezi kapıdan çözer", async () => {
  readEmployerPaymentCompany.mockResolvedValue({ companyId: "company-1", hasAddress: false });

  await expect(readEmployerPaymentRequirements(gates, {
    ...assignment,
    employerType: "COMPANY",
  })).resolves.toEqual({
    advisories: ["companyBillingAddress"],
    blocked: [],
  });
});
