// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { identityPhotoTransportMaxBytes } from "@/identity/document-upload-policy";
import { ApiError } from "@/server/api/errors";

const readSession = vi.hoisted(() => vi.fn());
const loadViewer = vi.hoisted(() => vi.fn());
const submitIdentityDocuments = vi.hoisted(() => vi.fn());
const takeIdentityUploadQuota = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("@/server/session/viewer", () => ({ loadViewer }));
vi.mock("@/server/identity/documents", () => ({ submitIdentityDocuments }));
vi.mock("@/server/identity/upload-rate-limit", () => ({ takeIdentityUploadQuota }));

import { POST } from "./route";

describe("POST /api/users/me/identity-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takeIdentityUploadQuota.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    loadViewer.mockResolvedValue({ viewer: { id: "user-1" }, failure: null });
    readSession.mockResolvedValue({
      deviceId: "device-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    submitIdentityDocuments.mockResolvedValue(undefined);
  });

  it("oturumsuz isteği multipart gövdeye dokunmadan reddeder", async () => {
    readSession.mockResolvedValue({ deviceId: "device-1", accessToken: null, refreshToken: null });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    });
    expect(takeIdentityUploadQuota).not.toHaveBeenCalled();
    expect(loadViewer).not.toHaveBeenCalled();
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("kotası dolan oturumu multipart gövdeye dokunmadan sınırlar", async () => {
    readSession.mockResolvedValue({
      deviceId: "device-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    takeIdentityUploadQuota.mockReturnValue({ allowed: false, retryAfterSeconds: 90 });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    await expect(response.json()).resolves.toEqual({
      status: "error",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(takeIdentityUploadQuota).toHaveBeenCalledWith("device-1");
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("çerezi olsa bile backend'in doğrulamadığı oturumda gövdeyi okumaz", async () => {
    loadViewer.mockResolvedValue({
      viewer: null,
      failure: { status: 401, errorCode: "AUTHENTICATION_REQUIRED" },
    });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(401);
    expect(loadViewer).toHaveBeenCalledOnce();
    expect(takeIdentityUploadQuota).not.toHaveBeenCalled();
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("bildirilen 42 MiB üzeri gövdeyi ayrıştırmadan reddeder", async () => {
    readSession.mockResolvedValue({
      deviceId: "device-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    const response = await POST(unreadableRequest({
      "content-length": String(identityPhotoTransportMaxBytes + 1),
    }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 413,
      fieldErrors: {
        photos: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
      },
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("content-length yoksa 42 MiB üzerinde akışı durdurur", async () => {
    let produced = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced > 42) {
          controller.close();
          return;
        }
        produced += 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    const request = new Request("https://iskoala.com/api/users/me/identity-documents", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(produced).toBe(43);
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("eski 11 MiB sınırını aşan dört gerçekçi fotoğrafı backend'e taşır", async () => {
    const response = await POST(multipartRequest(4 * 1024 * 1024));

    expect(await response.json()).toEqual({ status: "done" });
    expect(response.status).toBe(201);
    expect(submitIdentityDocuments).toHaveBeenCalledOnce();
    expect(submitIdentityDocuments).toHaveBeenCalledWith(
      {
        firstName: "Yusuf",
        lastName: "Acmaci",
        birthDate: "1998-04-12",
        identityNumber: "10000000146",
        tcDocumentNumber: "A01A00000",
      },
      {
        selfie: expect.objectContaining({ name: "yuz.jpg", size: 4 * 1024 * 1024 }),
        front: expect.objectContaining({ name: "on.jpg", size: 4 * 1024 * 1024 }),
        back: expect.objectContaining({ name: "arka.webp", size: 4 * 1024 * 1024 }),
        together: expect.objectContaining({ name: "birlikte.jpg", size: 4 * 1024 * 1024 }),
      },
    );
  });

  it("dört fotoğrafın tam 40 MiB içerik sınırını kabul eder", async () => {
    const response = await POST(multipartRequest(10 * 1024 * 1024));

    expect(await response.json()).toEqual({ status: "done" });
    expect(response.status).toBe(201);
    expect(submitIdentityDocuments).toHaveBeenCalledOnce();
  });

  it("40 MiB üzerindeki fotoğraf toplamını backend'e taşımadan Türkçe açıklar", async () => {
    const response = await POST(multipartRequest(10 * 1024 * 1024, {
      selfie: { size: 10 * 1024 * 1024 + 1 },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: {
        photos: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
        selfie: "Fotoğraf en fazla 10 MB olabilir.",
      },
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("tek fotoğrafın 10 MiB sınırını toplamdan bağımsız korur", async () => {
    const response = await POST(multipartRequest(1024, {
      selfie: { size: 10 * 1024 * 1024 + 1 },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      fieldErrors: { selfie: "Fotoğraf en fazla 10 MB olabilir." },
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("dosya uzantısı ile MIME türü uyuşmayan fotoğrafı reddeder", async () => {
    const response = await POST(multipartRequest(1024, {
      front: { contentType: "application/pdf" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      fieldErrors: { front: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç." },
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("backend reddini ham mesajını sızdırmadan form durumuna çevirir", async () => {
    submitIdentityDocuments.mockRejectedValue(new ApiError({
      status: 400,
      errorCode: "IDENTITY_DOCUMENTS_ALREADY_PENDING",
      errorCategory: "VALIDATION_FAILED",
      message: "backend ham mesajı",
    }));

    const response = await POST(multipartRequest(1024));

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toBe(
      '{"status":"error","errorCode":"IDENTITY_DOCUMENTS_ALREADY_PENDING","httpStatus":400}',
    );
    expect(body).not.toContain("backend ham mesajı");
  });
});

function unreadableRequest(headers?: HeadersInit): Request {
  return {
    headers: new Headers({ "content-type": "multipart/form-data; boundary=test", ...Object.fromEntries(new Headers(headers)) }),
    get body(): never {
      throw new Error("Gövde oturum ve kota kapılarından önce okunmamalı.");
    },
  } as unknown as Request;
}

type PhotoOverride = {
  readonly size?: number;
  readonly fileName?: string;
  readonly contentType?: string;
};

function multipartRequest(
  photoSize: number,
  overrides: Readonly<Record<string, PhotoOverride>> = {},
): Request {
  const boundary = "koala-identity-test-boundary";
  const fields = {
    firstName: "Yusuf",
    lastName: "Acmaci",
    birthDate: "1998-04-12",
    identityNumber: "10000000146",
    tcDocumentNumber: "A01A00000",
  };
  const photos = [
    ["selfie", "yuz.jpg", "image/jpeg"],
    ["front", "on.jpg", "image/jpeg"],
    ["back", "arka.webp", "image/webp"],
    ["together", "birlikte.jpg", "image/jpeg"],
  ] as const;
  const chunks: Array<string | Uint8Array<ArrayBuffer>> = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }
  for (const [name, defaultFileName, defaultContentType] of photos) {
    const { size = photoSize, fileName = defaultFileName, contentType = defaultContentType } =
      overrides[name] ?? {};
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`,
      new Uint8Array(new ArrayBuffer(size)),
      "\r\n",
    );
  }
  chunks.push(`--${boundary}--\r\n`);
  const body = new Blob(chunks, { type: `multipart/form-data; boundary=${boundary}` });
  return new Request("https://iskoala.com/api/users/me/identity-documents", {
    method: "POST",
    headers: { "content-type": body.type },
    body,
  });
}
