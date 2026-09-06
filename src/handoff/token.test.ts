import { describe, expect, it } from "vitest";
import { readSingleToken, readUuidToken } from "./token";

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

describe("kayıt tokenı", () => {
  it("UUID biçimindeki tokenı kabul eder", () => {
    expect(readUuidToken("3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607")).toEqual({
      ok: true,
      value: "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607",
    });
  });

  it.each([undefined, "", "abc", ["bir", "iki"], "3f1a2b4c5d6e4f708a91b2c3d4e5f607"])(
    "UUID olmayan değeri reddeder ve backend'e sormaz",
    (value) => {
      // Kayıt tokenı backend'de UUID; başka bir dize Jackson'da 400'e
      // dönüşür ve boşuna bir hız sınırı hakkı yakardı.
      expect(readUuidToken(value)).toEqual({ ok: false });
    },
  );
});
