import "server-only";

import {
  verificationMethods,
  type VerificationMethod,
  type WorkerIdentity,
} from "@/assignments/identity-reveal";
import { clean, known } from "@/server/api/dto";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * `GET /job-assignments/{id}/worker-identity` (backend 0.9.27,
 * is-koala/koala-backend#312).
 *
 * Yalnız server action'dan çağrılır, sayfa çiziminden değil: sunucu her
 * okumayı kayda geçiriyor ve işçiye bildiriyor, yani sayfayı açmak bir
 * "görüntüleme" sayılmamalı. `no-store`, çünkü aynı sebeple ikinci bir
 * okuma yeni bir istek olmalı; Next'in fetch önbelleği onu sessizce
 * yutabilirdi.
 *
 * Yanıt hiçbir yerde günlüklenmiyor ve bu modül ham DTO'yu geri vermiyor:
 * ekranın okuduğu beş alan dışında ne gelirse sınırda kalıyor.
 */

const verificationMethodSet: ReadonlySet<VerificationMethod> = new Set(verificationMethods);

type WorkerIdentityDto = {
  fullName?: string | null;
  tcIdentityNumber?: string | null;
  birthDate?: string | null;
  verifiedAt?: string | null;
  verificationMethod?: string | null;
};

export async function readWorkerIdentity(assignmentId: string): Promise<WorkerIdentity> {
  const dto = await apiRequest<WorkerIdentityDto | null>(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/worker-identity`,
    { cache: "no-store" },
  );

  return {
    fullName: clean(dto?.fullName) ?? "",
    tcIdentityNumber: clean(dto?.tcIdentityNumber) ?? "",
    birthDate: clean(dto?.birthDate),
    verifiedAt: clean(dto?.verifiedAt),
    verificationMethod: known(dto?.verificationMethod, verificationMethodSet),
  };
}
