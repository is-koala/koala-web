import "server-only";

import type { EmployerAssignment } from "@/payments/contract";
import {
  corporatePaymentGate,
  gateVerdictRequirements,
  type GateRequirements,
  type ViewerGates,
} from "@/server/session/gates";

import { readEmployerPaymentCompany } from "./payments";

export async function readEmployerPaymentRequirements(
  gates: ViewerGates,
  assignment: EmployerAssignment,
): Promise<GateRequirements> {
  if (assignment.employerType === "INDIVIDUAL") {
    return gateVerdictRequirements(gates.individualPayment);
  }
  if (assignment.employerType === "COMPANY") {
    const company = await readEmployerPaymentCompany(assignment.jobId);
    return gateVerdictRequirements(
      corporatePaymentGate(gates, company.companyId, company.hasAddress),
    );
  }
  return { advisories: [], blocked: [] };
}
