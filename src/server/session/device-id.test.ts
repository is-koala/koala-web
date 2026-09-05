import { describe, expect, it } from "vitest";

import { createDeviceId, isValidDeviceId } from "./device-id";

// Backend `DeviceIdentity.SAFE_ID` deseninin birebir kopyası: istemcinin
// ürettiği kimlik bu kalıba uymazsa backend başlığı yok sayar.
const backendDeviceIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

describe("tarayıcı profili cihaz kimliği", () => {
  it("backend regex'ine uyan 32 karakterlik kimlik üretir", () => {
    const deviceId = createDeviceId();

    expect(deviceId).toHaveLength(32);
    expect(deviceId).toMatch(backendDeviceIdPattern);
  });

  it("her çağrıda ayrı kimlik üretir", () => {
    const identities = new Set(Array.from({ length: 50 }, () => createDeviceId()));

    expect(identities.size).toBe(50);
  });

  it.each([
    ["kisa", false],
    ["", false],
    ["bosluk iceren kimlik degeri", false],
    ["tire-ve-nokta.iceren@kimlik", false],
    ["a".repeat(129), false],
    ["a".repeat(8), true],
    ["gecerli.kimlik:0-9_", true],
  ])("%s değerini backend kalıbına göre değerlendirir", (candidate, expected) => {
    expect(isValidDeviceId(candidate)).toBe(expected);
  });
});
