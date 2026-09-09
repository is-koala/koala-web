import { describe, expect, it } from "vitest";

import { safeRequestId } from "./errors";

describe("safeRequestId", () => {
  it.each([
    "4c470f1a-ea28-4c8a-9f75-8e9ac7d0fc5e",
    "4C470F1A-EA28-4C8A-9F75-8E9AC7D0FC5E",
  ])("backend UUID korelasyon kimliğini istemciye taşıyabilir: %s", (requestId) => {
    expect(safeRequestId(requestId)).toBe(requestId);
  });

  it.each([
    null,
    undefined,
    "",
    "request-delete-1",
    "sk_live_1234567890abcdef",
    "Bearer.eyJhbGciOiJIUzI1NiJ9.signature",
    "4c470f1a-ea28-4c8a-9f75-8e9ac7d0fc5e-extra",
  ])("UUID olmayan upstream değerini istemciye sızdırmaz: %s", (requestId) => {
    expect(safeRequestId(requestId)).toBeNull();
  });
});
