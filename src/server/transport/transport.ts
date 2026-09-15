import "server-only";

import { unstable_rethrow } from "next/navigation";

import { readAddressWrite } from "@/address/write";
import { ApiError } from "@/server/api/errors";
import { backendPaths, jobPath, notFoundStatus } from "@/server/contract";
import { apiRequest } from "@/server/session/session";
import type { AssignmentTransport, SeatSelection, TransportPlan } from "@/transport/contract";
import {
  parseTransportPlanField,
  transportAddressField,
  transportPlanErrors,
  transportPlanField,
  transportPlanWriteBody,
  type TransportPlanDraft,
  type TransportPlanWriteBody,
} from "@/transport/plan-form";

import {
  toAssignmentTransport,
  toTransportPlan,
  type AssignmentTransportDto,
  type TransportPlanDto,
} from "./dto";

/**
 * Ulaşım planı uçlarının oturumlu sunucu tarafı (backend 0.9.28,
 * is-koala/koala-web#187). Tarayıcı `api.iskoala.com` ile konuşmuyor
 * (ADR-0011); her çağrı `apiRequest` üzerinden ve `no-store`: plan ile
 * koltuklar başka bir cihazdan değişebiliyor ve bayat bir okuma "dolu"
 * serviste boş koltuk vaat ederdi.
 */

/** `GET /jobs/{jobId}/transport-plan`; plan yoksa **ve** eski sunucuda `null`. */
export async function readTransportPlan(jobId: string): Promise<TransportPlan | null> {
  const dto = await readOrNull<TransportPlanDto>(`${jobPath(jobId)}/transport-plan`);
  return dto === null ? null : toTransportPlan(dto);
}

/** `PUT /jobs/{jobId}/transport-plan`; yanıt yazılan planın işveren görünümü. */
export async function writeTransportPlan(
  jobId: string,
  body: TransportPlanWriteBody,
): Promise<TransportPlan> {
  const dto = await apiRequest<TransportPlanDto | null>(`${jobPath(jobId)}/transport-plan`, {
    method: "PUT",
    body,
    cache: "no-store",
  });
  return toTransportPlan(dto ?? {});
}

/**
 * `GET /job-assignments/{id}/transport`; ilanın planı yoksa backend 404
 * veriyor ve eski sunucu yolu hiç tanımıyor — ikisi de `null`, kart çizilmiyor.
 */
export async function readAssignmentTransport(
  assignmentId: string,
): Promise<AssignmentTransport | null> {
  const dto = await readOrNull<AssignmentTransportDto>(`${assignmentTransportPath(assignmentId)}`);
  return dto === null ? null : toAssignmentTransport(dto);
}

/** `PUT /job-assignments/{id}/transport/seat`; yön servisin yönünden türüyor. */
export async function selectSeat(
  assignmentId: string,
  selection: SeatSelection,
): Promise<AssignmentTransport> {
  const dto = await apiRequest<AssignmentTransportDto | null>(
    `${assignmentTransportPath(assignmentId)}/seat`,
    { method: "PUT", body: selection, cache: "no-store" },
  );
  return toAssignmentTransport(dto ?? {});
}

function assignmentTransportPath(assignmentId: string): string {
  return `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/transport`;
}

async function readOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiRequest<T | null>(path, { cache: "no-store" });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === notFoundStatus) return null;
    throw error;
  }
}

/**
 * Form gövdesinden ulaşım planını okur: gizli JSON taslağı + durak başına
 * adres alanı. Üç sonuç var — alan hiç yoksa `absent` (sihirbazda ulaşım
 * adımı boş bırakıldı), kural ihlali varsa `invalid` ve alan hataları, aksi
 * hâlde gövde.
 */
export type TransportPlanRead =
  | { status: "absent" }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "ready"; draft: TransportPlanDraft; body: TransportPlanWriteBody };

export function readTransportPlanWrite(formData: FormData): TransportPlanRead {
  const raw = formData.get(transportPlanField);
  if (typeof raw !== "string" || !raw) return { status: "absent" };

  const draft = parseTransportPlanField(raw);
  if (draft === null) {
    return { status: "invalid", fieldErrors: { shuttles: "Ulaşım planı okunamadı; sayfayı yenileyip yeniden dene." } };
  }

  const addressOf = (stopKey: string) => readAddressWrite(formData, transportAddressField(stopKey));
  const fieldErrors = transportPlanErrors(draft, (key) => addressOf(key) !== null);
  if (Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors };

  const body = transportPlanWriteBody(draft, addressOf);
  return body === null ? { status: "invalid", fieldErrors } : { status: "ready", draft, body };
}
