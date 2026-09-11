import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { identityChipPaUnavailableErrorCode } from "@/identity/handoff";

import { POST as verifyIdentity } from "./route";
import { POST as challengeIdentity } from "./challenge/route";

describe("kimlik BFF stub", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["doğrulama", verifyIdentity],
    ["challenge", challengeIdentity],
  ])("%s ucu çip alanlarını backend'e taşımadan 501 ve aktarım ekranına yönlendirir", async (_name, handler) => {
    const response = await handler();

    expect(response.status).toBe(501);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Location")).toBe("/kimlik-dogrula");
    expect(await response.json()).toEqual({
      errorCode: identityChipPaUnavailableErrorCode,
      httpStatus: 501,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
