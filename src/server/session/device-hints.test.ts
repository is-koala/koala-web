import { afterEach, describe, expect, it, vi } from "vitest";

import { requestHeaders } from "../../../tests/support/session-cookies";

import { operatingSystemFrom, webAppVersion, webDeviceHints } from "./device-hints";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ipad =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const mac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const windows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const linux = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";
const chromeOs =
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("cihaz ipuçları", () => {
  afterEach(() => {
    requestHeaders.delete("user-agent");
    requestHeaders.delete("sec-ch-ua-platform");
  });

  it.each([
    ["iPhone", iphone, "iOS 18.1"],
    ["iPad", ipad, "iOS 17.5"],
    ["Android", android, "Android 14"],
    ["macOS", mac, "macOS"],
    ["Windows", windows, "Windows"],
    ["Linux", linux, "Linux"],
    ["ChromeOS", chromeOs, "ChromeOS"],
  ])("%s tarayıcısının ajanından işletim sistemini okur", (_name, agent, expected) => {
    expect(operatingSystemFrom(agent)).toBe(expected);
  });

  it("masaüstü sürümünü yazmaz: tarayıcılar donmuş bir sürüm gönderiyor", () => {
    // Chrome hem macOS'te `10_15_7` hem Windows'ta `NT 10.0` diyor; sürüm
    // yazılsaydı yıllardır yanlış olurdu.
    expect(operatingSystemFrom(mac)).not.toContain("10");
    expect(operatingSystemFrom(windows)).not.toContain("10");
  });

  it("tanımadığı ajanda ve boş ajanda null döner; yer tutucu uydurmaz", () => {
    expect(operatingSystemFrom(null)).toBeNull();
    expect(operatingSystemFrom("")).toBeNull();
    expect(operatingSystemFrom("curl/8.4.0")).toBeNull();
  });

  it("isteğin ajanını okur, modeli boş bırakır ve build sürümünü koyar", async () => {
    requestHeaders.set("user-agent", iphone);

    await expect(webDeviceHints()).resolves.toEqual({
      model: null,
      os: "iOS 18.1",
      appVersion: webAppVersion,
    });
    // Backend `AppVersion.numericPrefix` gibi noktayla ayrılmış sayı bekliyor.
    expect(webAppVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("ajan tanınmazsa Chromium'un istemci ipucunu okur", async () => {
    requestHeaders.set("user-agent", "curl/8.4.0");
    requestHeaders.set("sec-ch-ua-platform", '"macOS"');

    await expect(webDeviceHints()).resolves.toMatchObject({ os: "macOS" });
  });

  it("istemci ipucu Unknown ise onu da yok sayar", async () => {
    requestHeaders.set("user-agent", "curl/8.4.0");
    requestHeaders.set("sec-ch-ua-platform", '"Unknown"');

    await expect(webDeviceHints()).resolves.toMatchObject({ os: null });
  });
});
