import "server-only";

import { createConcurrentTaskGate } from "@/server/concurrency";
import {
  identityUploadBodyIdleTimeoutMs,
  identityUploadBodyTotalTimeoutMs,
  identityUploadMaxConcurrentOperations,
} from "@/server/env";

import { readIdentityUploadRequest } from "./upload-request";
import type { IdentityUploadRequest } from "./upload-request";

/**
 * Ayrıştırılmış dört fotoğraf backend gönderimi bitene kadar bellekte kaldığı için
 * işlemin tamamı sınırlıdır. Deneme kotası değildir; her sonuç finally ile yer açar.
 */
export function createIdentityUploadOperationRunner(
  maxConcurrent: number,
  bodyReadIdleTimeoutMs: number,
  bodyReadTotalTimeoutMs: number,
) {
  const gate = createConcurrentTaskGate(maxConcurrent);
  return <Value>(
    request: Request,
    operation: (upload: IdentityUploadRequest) => Promise<Value>,
  ) => gate.run(async () => operation(await readIdentityUploadRequest(request, {
    idleTimeoutMs: bodyReadIdleTimeoutMs,
    totalTimeoutMs: bodyReadTotalTimeoutMs,
  })));
}

export const runIdentityUploadOperation = createIdentityUploadOperationRunner(
  identityUploadMaxConcurrentOperations(),
  identityUploadBodyIdleTimeoutMs(),
  identityUploadBodyTotalTimeoutMs(),
);
