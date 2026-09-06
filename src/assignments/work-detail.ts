import type { WorkerAssignment } from "@/assignments/contract";
import type { WorkerAssignmentResolution } from "@/assignments/resolution";

export type { CancellationPreview } from "@/assignments/resolution";

export type WorkAssignment = WorkerAssignment & {
  assignedAt: string | null;
  completedAt: string | null;
};

export type WorkSession = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  minutes: number | null;
};

/**
 * İş ayrıntısı ekranının tarayıcıya açtığı dar, serileştirilebilir görünüm.
 * Konum koordinatları ve backend'in kullanıcı/iş nesneleri bu sınırı geçmez.
 */
export type WorkDetail = {
  /** İlk sayaç metnini SSR ve hydration'da aynı tutan sunucu gözlem zamanı. */
  observedAt: number;
  assignment: WorkAssignment;
  description: string | null;
  duties: string | null;
  dressCode: string | null;
  fullAddress: string | null;
  sessions: readonly WorkSession[];
  resolution: WorkerAssignmentResolution;
};

export type CheckpointKind = "check-in" | "check-out";

export type WorkDetailCommand =
  | { type: "refresh" }
  | {
      type: "checkpoint";
      kind: CheckpointKind;
      point: { latitude: number; longitude: number } | null;
    }
  | { type: "cancel"; reason: string }
  | { type: "dispute"; reason: string }
  | { type: "review"; rating: number; comment: string };

export type WorkDetailActionResult =
  | { status: "done"; detail: WorkDetail }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      detail?: WorkDetail | null;
    };

export type WorkDetailAction = (
  command: WorkDetailCommand,
) => Promise<WorkDetailActionResult>;
