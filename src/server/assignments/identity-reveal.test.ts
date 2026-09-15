import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readWorkerIdentity } from "./identity-reveal";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("işçi kimliği backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kimliği önbelleksiz okur ve beş alana daraltır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({
        fullName: "Çağrı Yılmaz",
        tcIdentityNumber: "10000000146",
        birthDate: "1990-05-17",
        verifiedAt: "2026-09-01T10:15:30Z",
        verificationMethod: "DOCUMENT",
        // Backend ileride alan eklerse sınırı geçmemeli.
        documentNumber: "A12B34567",
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkerIdentity(assignmentId)).resolves.toEqual({
      fullName: "Çağrı Yılmaz",
      tcIdentityNumber: "10000000146",
      birthDate: "1990-05-17",
      verifiedAt: "2026-09-01T10:15:30Z",
      verificationMethod: "DOCUMENT",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/worker-identity`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("tanınmayan doğrulama yöntemini UNKNOWN'a, boş alanları null'a düşürür", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({
        fullName: " Ayşe Yılmaz ",
        tcIdentityNumber: "10000000146",
        birthDate: null,
        verifiedAt: "",
        verificationMethod: "BIOMETRIC",
      })),
    ));

    await expect(readWorkerIdentity(assignmentId)).resolves.toEqual({
      fullName: "Ayşe Yılmaz",
      tcIdentityNumber: "10000000146",
      birthDate: null,
      verifiedAt: null,
      verificationMethod: "UNKNOWN",
    });
  });

  it.each([
    [409, "WORKER_IDENTITY_NOT_VERIFIED"],
    [429, "IDENTITY_REVEAL_TOO_MANY_REQUESTS"],
    [404, "JOB_ASSIGNMENT_NOT_FOUND"],
  ])("%i reddini errorCode ile ApiError olarak yükseltir", async (status, errorCode) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(status, {
        success: false,
        httpStatus: status,
        errorCode,
        message: "reddedildi",
        timeStamp: "2026-09-09T12:00:00Z",
      }),
    ));

    const failure = await readWorkerIdentity(assignmentId).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status, errorCode });
  });
});
