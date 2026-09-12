import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../tests/support/session-cookies";

import { submitIdentityDocumentsAction } from "./actions";

vi.mock("next/headers", async () => {
  const support = await import("../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const mebibyte = 1024 * 1024;

describe("kimlik belge action", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/kimlik-dogrula");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("eksik fotoğrafı backend'e taşımadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await submitIdentityDocumentsAction(idleFormState, declaredForm());

    expect(state).toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: {
        selfie: "Yüzünün fotoğrafını seç.",
        front: "Kimliğin ön yüzünün fotoğrafını seç.",
        back: "Kimliğin arka yüzünün fotoğrafını seç.",
        together: "Kartın yüzünün altında olduğu fotoğrafı seç.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("40 MiB üzerindeki toplamı backend'e taşımadan Türkçe açıklar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const form = declaredForm();
    form.set("selfie", imageFile(10 * mebibyte + 1, "yuz.jpg"));
    form.set("front", imageFile(10 * mebibyte, "on.jpg"));
    form.set("back", imageFile(10 * mebibyte, "arka.webp", "image/webp"));
    form.set("together", imageFile(10 * mebibyte, "birlikte.jpg"));

    const state = await submitIdentityDocumentsAction(idleFormState, form);

    expect(state).toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: {
        photos: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
        selfie: "Fotoğraf en fazla 10 MB olabilir.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("eski 11 MiB taşıma sınırını aşan dört gerçekçi fotoğrafı kabul eder", async () => {
    const fetchMock = successfulUpload();
    vi.stubGlobal("fetch", fetchMock);
    const form = declaredForm();
    form.set("selfie", imageFile(4 * mebibyte, "yuz.jpg"));
    form.set("front", imageFile(4 * mebibyte, "on.jpg"));
    form.set("back", imageFile(4 * mebibyte, "arka.webp", "image/webp"));
    form.set("together", imageFile(4 * mebibyte, "birlikte.jpg"));

    await expect(submitIdentityDocumentsAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("dört dosyanın 40 MiB toplam sınırını kabul eder", async () => {
    const fetchMock = successfulUpload();
    vi.stubGlobal("fetch", fetchMock);
    const form = declaredForm();
    form.set("selfie", imageFile(10 * mebibyte, "yuz.jpg"));
    form.set("front", imageFile(10 * mebibyte, "on.jpg"));
    form.set("back", imageFile(10 * mebibyte, "arka.webp", "image/webp"));
    form.set("together", imageFile(10 * mebibyte, "birlikte.jpg"));

    await expect(submitIdentityDocumentsAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("tek fotoğrafın 10 MiB sınırını korur", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const form = declaredPhotoForm();
    form.set("selfie", imageFile(10 * mebibyte + 1, "yuz.jpg"));

    const state = await submitIdentityDocumentsAction(idleFormState, form);

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { selfie: "Fotoğraf en fazla 10 MB olabilir." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("desteklenmeyen fotoğraf biçimini backend'e taşımaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const form = declaredPhotoForm();
    form.set("front", imageFile(1024, "kimlik.pdf", "application/pdf"));

    const state = await submitIdentityDocumentsAction(idleFormState, form);

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { front: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geçerli belgede çip alanlarını göndermeden kuyruğa düşürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({ status: "PENDING" })));
    vi.stubGlobal("fetch", fetchMock);
    const selfie = new File(["yuz"], "yuz.jpg", { type: "image/jpeg" });
    const front = new File(["on"], "on.jpg", { type: "image/jpeg" });
    const back = new File(["arka"], "arka.webp", { type: "image/webp" });
    const together = new File(["birlikte"], "birlikte.jpg", { type: "image/jpeg" });
    const form = declaredForm();
    form.set("selfie", selfie);
    form.set("front", front);
    form.set("back", back);
    form.set("together", together);

    await expect(submitIdentityDocumentsAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    const identity = JSON.parse(await (body.get("identity") as Blob).text()) as Record<string, unknown>;
    expect(identity).toEqual({
      firstName: "Yusuf",
      lastName: "Acmaci",
      birthDate: "1998-04-12",
      tcIdentityNumber: "10000000146",
      tcDocumentNumber: "A01A00000",
    });
    expect(identity).not.toHaveProperty("sod");
    expect(identity).not.toHaveProperty("dg1");
    expect(body.get("selfie")).toBe(selfie);
    expect(body.get("front")).toBe(front);
    expect(body.get("back")).toBe(back);
    expect(body.get("together")).toBe(together);
  });
});

function declaredForm(): FormData {
  const form = new FormData();
  form.set("firstName", "Yusuf");
  form.set("lastName", "Acmaci");
  form.set("birthDate", "1998-04-12");
  form.set("identityNumber", "10000000146");
  form.set("tcDocumentNumber", "A01A00000");
  return form;
}

function declaredPhotoForm(): FormData {
  const form = declaredForm();
  form.set("selfie", imageFile(1024, "yuz.jpg"));
  form.set("front", imageFile(1024, "on.jpg"));
  form.set("back", imageFile(1024, "arka.webp", "image/webp"));
  form.set("together", imageFile(1024, "birlikte.jpg"));
  return form;
}

function imageFile(size: number, name: string, type = "image/jpeg"): File {
  return new File([new Uint8Array(size)], name, { type });
}

function successfulUpload() {
  return vi.fn().mockResolvedValue(jsonResponse(201, envelope({ status: "PENDING" })));
}
