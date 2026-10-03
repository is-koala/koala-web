// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { identityPhotoTransportMaxBytes } from "@/identity/document-upload-policy";
import { ApiError } from "@/server/api/errors";

const readSession = vi.hoisted(() => vi.fn());
const loadViewer = vi.hoisted(() => vi.fn());
const submitIdentityDocuments = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("@/server/session/viewer", () => ({ loadViewer }));
vi.mock("@/server/identity/documents", () => ({ submitIdentityDocuments }));

import { POST } from "./route";

describe("POST /api/users/me/identity-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(loadViewer).not.toHaveBeenCalled();
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("iki yükleme backend'e gönderilirken üçüncüyü başlatmaz ve bitince yeniden yer açar", async () => {
    let finishSubmits: () => void = () => undefined;
    let markBothStarted: () => void = () => undefined;
    let startedSubmits = 0;
    const bothStarted = new Promise<void>((resolve) => {
      markBothStarted = resolve;
    });
    const submitsFinished = new Promise<void>((resolve) => {
      finishSubmits = resolve;
    });
    submitIdentityDocuments.mockImplementation(async () => {
      startedSubmits += 1;
      if (startedSubmits === 2) markBothStarted();
      await submitsFinished;
    });
    const first = POST(multipartRequest(1024));
    const second = POST(multipartRequest(1024));
    await bothStarted;

    const third = await POST(unreadableRequest());

    expect(third.status).toBe(503);
    expect(third.headers.get("Retry-After")).toBe("1");
    await expect(third.json()).resolves.toEqual({
      status: "error",
      errorCode: "IDENTITY_UPLOAD_CAPACITY_UNAVAILABLE",
      httpStatus: 503,
    });
    finishSubmits();
    await expect(first).resolves.toMatchObject({ status: 201 });
    await expect(second).resolves.toMatchObject({ status: 201 });

    submitIdentityDocuments.mockResolvedValue(undefined);
    const afterCompletion = await POST(invalidMultipartRequest());
    expect(afterCompletion.status).toBe(400);
  });

  it("çerezi olsa bile backend'in doğrulamadığı oturumda gövdeyi okumaz", async () => {
    loadViewer.mockResolvedValue({
      viewer: null,
      failure: { status: 401, errorCode: "AUTHENTICATION_REQUIRED" },
    });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(401);
    expect(loadViewer).toHaveBeenCalledOnce();
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("HTTP durumu olmayan profil arızasını geçerli 500 yanıtına çevirir", async () => {
    loadViewer.mockResolvedValue({
      viewer: null,
      failure: { status: 0, errorCode: "UNEXPECTED" },
    });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      errorCode: "UNEXPECTED",
      httpStatus: 500,
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("backend oturumu bitirip girişe yönelttiğinde yapılandırılmış 401 döner", async () => {
    loadViewer.mockRejectedValue({
      digest: "NEXT_REDIRECT;replace;/giris?next=%2Fapi%2Fusers%2Fme%2Fidentity-documents;307;",
    });

    const response = await POST(unreadableRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("ön kontrolden sonra backend gönderiminde biten oturumu yapılandırılmış 401 yapar", async () => {
    submitIdentityDocuments.mockRejectedValue({
      digest: "NEXT_REDIRECT;replace;/giris?next=%2Fapi%2Fusers%2Fme%2Fidentity-documents;307;",
    });

    const response = await POST(multipartRequest(1024));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    });
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
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        host: "iskoala.com",
        origin: "https://iskoala.com",
      },
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
        back: expect.objectContaining({ name: "arka.png", size: 4 * 1024 * 1024 }),
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
      fieldErrors: { front: "PNG, JPG veya JPEG biçiminde bir fotoğraf seç." },
    });
    expect(submitIdentityDocuments).not.toHaveBeenCalled();
  });

  it("WebP fotoğrafı backend'e göndermeden reddeder", async () => {
    // Backend WebP'yi okuyamıyor (ImageIO okuyucusu yok, koala-backend#348):
    // dört fotoğraflık yükleme her seferinde `STORAGE_UNSUPPORTED_TYPE` alırdı.
    const response = await POST(multipartRequest(1024, {
      back: { fileName: "arka.webp", contentType: "image/webp" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      fieldErrors: { back: "PNG, JPG veya JPEG biçiminde bir fotoğraf seç." },
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
    headers: new Headers({
      "content-type": "multipart/form-data; boundary=test",
      host: "iskoala.com",
      origin: "https://iskoala.com",
      ...Object.fromEntries(new Headers(headers)),
    }),
    url: "https://iskoala.com/api/users/me/identity-documents",
    get body(): never {
      throw new Error("Gövde oturum ve kapasite kapılarından önce okunmamalı.");
    },
  } as unknown as Request;
}

function invalidMultipartRequest(): Request {
  return new Request("https://iskoala.com/api/users/me/identity-documents", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=test",
      host: "iskoala.com",
      origin: "https://iskoala.com",
    },
    body: "geçersiz multipart",
  });
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
    ["back", "arka.png", "image/png"],
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
    headers: {
      "content-type": body.type,
      host: "iskoala.com",
      origin: "https://iskoala.com",
    },
    body,
  });
}
