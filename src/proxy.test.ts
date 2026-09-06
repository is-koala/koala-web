import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

// Backend `DeviceIdentity.SAFE_ID` deseninin bağımsız kopyası: uygulama
// sabitini içeri almak, sabit yanlışsa testin de yanlış geçmesi demek olurdu.
const backendDeviceIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

function request(path = "/", init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`https://iskoala.com${path}`, init);
}

function setCookieFor(response: Response, name: string) {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`));
}

/** Tarayıcının çereze yazacağı ham değer. */
function storedValueOf(setCookie: string | undefined) {
  return setCookie?.split(";")[0]?.split("=")[1] ?? "";
}

describe("BFF cihaz kimliği vekili", () => {
  it("cookie yoksa cihaz kimliği üretir ve HttpOnly çerezde saklar", () => {
    const response = proxy(request());

    const cookie = setCookieFor(response, "koala_did");
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
    expect(response.cookies.get("koala_did")?.value).toMatch(backendDeviceIdPattern);
  });

  it("üretilen kimliği aynı istekte SSR'ın görebilmesi için ileri taşır", () => {
    const incoming = request();

    const response = proxy(incoming);

    expect(incoming.cookies.get("koala_did")?.value).toBe(
      response.cookies.get("koala_did")?.value,
    );
  });

  it("isteğin yolunu SSR'ın okuyabilmesi için ileri taşır", () => {
    const incoming = request("/panel/islerim?filtre=acik");

    proxy(incoming);

    expect(incoming.headers.get("x-koala-path")).toBe("/panel/islerim?filtre=acik");
  });

  it("tarayıcının gönderdiği yol başlığını üzerine yazar", () => {
    const incoming = request("/panel", { headers: { "x-koala-path": "//kotu.example" } });

    proxy(incoming);

    expect(incoming.headers.get("x-koala-path")).toBe("/panel");
  });

  it("geçerli kimlik varsa korur ve yeniden yazmaz", () => {
    const existing = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

    const response = proxy(request("/", { headers: { cookie: `koala_did=${existing}` } }));

    expect(setCookieFor(response, "koala_did")).toBeUndefined();
  });

  it("ardışık SSR ve action çağrıları aynı cihaz kimliğini taşır", () => {
    const navigation = request("/panel");
    const navigationResponse = proxy(navigation);
    // Tarayıcının saklayacağı değer ham Set-Cookie'den okunur: SSR'ın gördüğü
    // kimlikle tarayıcıya yazılan aynı olmazsa zincir daha ilk adımda kopar.
    const stored = storedValueOf(setCookieFor(navigationResponse, "koala_did"));

    const action = request("/panel", {
      method: "POST",
      headers: {
        cookie: `koala_did=${stored}`,
        origin: "https://iskoala.com",
        host: "iskoala.com",
      },
    });
    const actionResponse = proxy(action);

    expect(stored).toMatch(backendDeviceIdPattern);
    expect(navigation.cookies.get("koala_did")?.value).toBe(stored);
    // Action yeni kimlik üretseydi backend oturumu pasifleştirirdi.
    expect(setCookieFor(actionResponse, "koala_did")).toBeUndefined();
  });

  it("backend kalıbına uymayan kimliği yenisiyle değiştirir", () => {
    const response = proxy(request("/", { headers: { cookie: "koala_did=kisa" } }));

    expect(response.cookies.get("koala_did")?.value).toMatch(backendDeviceIdPattern);
  });

  it("durum değiştiren isteği yabancı origin'den reddeder", () => {
    const response = proxy(
      request("/hesap-dogrula", {
        method: "POST",
        headers: { origin: "https://kotu.example", host: "iskoala.com" },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("durum değiştiren isteği origin başlığı hiç yoksa da reddeder", () => {
    const response = proxy(
      request("/hesap-dogrula", { method: "POST", headers: { host: "iskoala.com" } }),
    );

    expect(response.status).toBe(403);
  });

  it("aynı origin'den gelen durum değiştiren isteği geçirir", () => {
    const response = proxy(
      request("/hesap-dogrula", {
        method: "POST",
        headers: { origin: "https://iskoala.com", host: "iskoala.com" },
      }),
    );

    expect(response.status).toBe(200);
  });

  it("güvenli yöntemleri çapraz origin gezinmede engellemez", () => {
    const response = proxy(
      request("/sss", { headers: { origin: "https://google.com", host: "iskoala.com" } }),
    );

    expect(response.status).toBe(200);
  });

  it("cihaz kimliğini yaklaşık iki yıl yaşatır", () => {
    const cookie = setCookieFor(proxy(request()), "koala_did") ?? "";

    expect(cookie).toContain("Max-Age=63072000");
  });
});
