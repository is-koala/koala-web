import { describe, expect, it } from "vitest";
import { readSingleToken } from "./token";

describe("karşılama tokenı", () => {
  it("tek ve dolu tokenı kabul eder", () => {
    expect(readSingleToken("token-1")).toEqual({ ok: true, value: "token-1" });
  });

  it.each([undefined, "", " ", ["bir", "iki"], "x".repeat(2049)])(
    "eksik, yinelenen veya aşırı uzun tokenı reddeder",
    (value) => {
      expect(readSingleToken(value)).toEqual({ ok: false });
    },
  );
});
