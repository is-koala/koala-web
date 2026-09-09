import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  jsonResponse,
  requestHeaders,
} from "../../../../../../../../tests/support/session-cookies";

import { GET } from "./route";

const disputeId = "8b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6a";
const evidenceId = "9b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6b";

vi.mock("next/headers", async () => {
  const support = await import("../../../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) throw error;
  },
}));

describe("GET /api/disputes/:disputeId/evidence/:evidenceId/download", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e");
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("özel kanıtı oturumlu backend çağrısından güvenli indirme yanıtına taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("kanıt", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": "6",
        "content-disposition": "attachment; filename=vardiya.pdf",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("kanıt");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.test/disputes/${disputeId}/evidence/${evidenceId}/download`,
    );
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-placeholder");
  });

  it.each([302, 307])("backend %s yönlendirmesini yalnız izinli S3 hedefine kimlik başlıkları olmadan izler", async (redirectStatus) => {
    const signedUrl =
      "https://koala-private.s3.eu-central-1.amazonaws.com/files/evidence.pdf?X-Amz-Signature=test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: redirectStatus,
        headers: { location: signedUrl },
      }))
      .mockResolvedValueOnce(new Response("kanıt", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": "attachment; filename=evidence.pdf",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("kanıt");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, backendInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(backendInit.redirect).toBe("manual");
    expect(backendInit.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(backendInit.headers).get("Authorization"))
      .toBe("Bearer access-placeholder");

    const [storageUrl, storageInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(storageUrl).toBe(signedUrl);
    expect(storageInit).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" });
    expect(storageInit.signal).toBe(backendInit.signal);
    const storageHeaders = new Headers(storageInit.headers);
    for (const name of [
      "Authorization",
      "X-Device-Id",
      "X-Forwarded-For",
      "X-App-Version",
      "X-Client-Platform",
    ]) {
      expect(storageHeaders.has(name)).toBe(false);
    }
  });

  it("S3 uyumlu özel depoyu yalnız sunucu allowlist'inde yer alıyorsa kullanır", async () => {
    const signedUrl = "https://objects.example-storage.test/private/evidence.pdf?signature=test";
    vi.stubEnv("EVIDENCE_STORAGE_ORIGINS", "https://objects.example-storage.test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: signedUrl },
      }))
      .mockResolvedValueOnce(new Response("kanıt", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(signedUrl);
  });

  it("allowlist dışı imzalı hedefi sunucudan istemeden güvenli hata döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: "https://169.254.169.254/latest/meta-data" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      errorCode: "STORAGE_DOWNLOAD_FAILED",
      httpStatus: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "http://koala-private.s3.eu-central-1.amazonaws.com/evidence.pdf?signature=test",
    "https://attacker:secret@koala-private.s3.eu-central-1.amazonaws.com/evidence.pdf?signature=test",
  ])("güvensiz imzalı hedefi sunucudan istemez: %s", async (location) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bozuk kimlikleri backend'e taşımadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId: "../admin", evidenceId }),
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("oturumsuz istekte backend'e çıkmaz", async () => {
    cookieStore.values.delete("koala_at");
    cookieStore.values.delete("koala_rt");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("istemci bağlantısı kesilince bekleyen backend indirmesini iptal eder", async () => {
    const controller = new AbortController();
    let upstreamSignal: AbortSignal | null = null;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal?.addEventListener("abort", () => reject(upstreamSignal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = GET(new Request("https://iskoala.com/api/disputes/x", {
      signal: controller.signal,
    }), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();

    const response = await responsePromise;
    expect(response.status).toBe(502);
    expect(upstreamSignal).not.toBeNull();
    expect((upstreamSignal as unknown as AbortSignal).aborted).toBe(true);
  });

  it("geçerli erişim tokenı varken yenileme çerezi olmasa da indirmeye izin verir", async () => {
    cookieStore.values.delete("koala_rt");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("kanıt", { status: 200 })));

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("kanıt");
    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("depo inline önerse bile kanıtı yalnız ek dosya olarak sunar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("kanıt", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename=calisan-belgesi.pdf",
      },
    })));

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("deponun güvenilmez dosya adını istemci yanıtına taşımaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("kanıt", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=../../zararli.html",
      },
    })));

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("backend reddinde ham hata metnini indirme yanıtına sızdırmaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {
      success: false,
      errorCode: "DISPUTE_EVIDENCE_NOT_FOUND",
      errorCategory: "RESOURCE_NOT_FOUND",
      message: "gizli depo yolu",
    })));

    const response = await GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      '{"errorCode":"DISPUTE_EVIDENCE_NOT_FOUND","httpStatus":404}',
    );
  });

  it("oturum yenilenemezse Next yönlendirmesini genel hataya dönüştürmez", async () => {
    const unauthorized = () => jsonResponse(401, {
      success: false,
      errorCode: "TOKEN_EXPIRED",
      errorCategory: "TOKEN_EXPIRED",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    await expect(GET(new Request("https://iskoala.com/api/disputes/x"), {
      params: Promise.resolve({ disputeId, evidenceId }),
    })).rejects.toThrow("NEXT_REDIRECT:/giris");
  });
});
