import "server-only";

import { createConcurrentTaskGate } from "@/server/concurrency";
import { identityUploadMaxConcurrentBodyReads } from "@/server/env";

import { readIdentityUploadRequest } from "./upload-request";

/**
 * Her gövde 42 MiB taşıyabildiği için okuma sayısı süreç belleğine göre sınırlıdır.
 * Bu bir deneme kotası değildir; tamamlanan veya hataya düşen okuma hemen yer açar.
 */
export function createIdentityUploadBodyReader(maxConcurrent: number) {
  const gate = createConcurrentTaskGate(maxConcurrent);
  return (request: Request) => gate.run(() => readIdentityUploadRequest(request));
}

export const readIdentityUploadBody = createIdentityUploadBodyReader(
  identityUploadMaxConcurrentBodyReads(),
);
