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
        front: "Kimliğin ön yüzünün fotoğrafını seç.",
        back: "Kimliğin arka yüzünün fotoğrafını seç.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geçerli belgede çip alanlarını göndermeden kuyruğa düşürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({ status: "PENDING" })));
    vi.stubGlobal("fetch", fetchMock);
    const front = new File(["on"], "on.jpg", { type: "image/jpeg" });
    const back = new File(["arka"], "arka.webp", { type: "image/webp" });
    const form = declaredForm();
    form.set("front", front);
    form.set("back", back);

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
    expect(body.get("front")).toBe(front);
    expect(body.get("back")).toBe(back);
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
