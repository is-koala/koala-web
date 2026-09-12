import "server-only";

import { createConcurrentTaskGate } from "@/server/concurrency";
import {
  identityUploadBodyIdleTimeoutMs,
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
  bodyReadIdleTimeoutMs = 15_000,
) {
  const gate = createConcurrentTaskGate(maxConcurrent);
  return <Value>(
    request: Request,
    operation: (upload: IdentityUploadRequest) => Promise<Value>,
  ) => gate.run(async () => operation(await readIdentityUploadRequest(request, {
    idleTimeoutMs: bodyReadIdleTimeoutMs,
  })));
}

export const runIdentityUploadOperation = createIdentityUploadOperationRunner(
  identityUploadMaxConcurrentOperations(),
  identityUploadBodyIdleTimeoutMs(),
);
