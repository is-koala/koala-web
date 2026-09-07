import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { completeAssignment, readAssignmentWorkSessions } from "./employer-tracking";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("işveren atama takibi backend modülü", () => {
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

  it("çalışma oturumlarını yalnız ekranın okuduğu alanlara daraltır", async () => {
    // `WorkSessionDto` on yedi alan taşıyor; ikisi konum koordinatı. Koordinat
    // tarayıcıya çıkarsa işçinin bulunduğu yer ekranın verisi olurdu.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: "session-1",
          jobAssignmentId: assignmentId,
          checkInAt: "2026-09-02T08:00:00Z",
          checkOutAt: "2026-09-02T12:30:00Z",
          minutes: 270,
          checkInLatitude: "40.9",
          checkInLongitude: "29.1",
          checkOutLatitude: "40.9",
          checkOutLongitude: "29.1",
        },
        {
          id: "session-2",
          jobAssignmentId: assignmentId,
          checkInAt: "2026-09-03T08:00:00Z",
          checkOutAt: null,
          minutes: null,
        },
      ])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAssignmentWorkSessions(assignmentId)).resolves.toEqual([
      { id: "session-1", checkInAt: "2026-09-02T08:00:00Z", checkOutAt: "2026-09-02T12:30:00Z", minutes: 270 },
      { id: "session-2", checkInAt: "2026-09-03T08:00:00Z", checkOutAt: null, minutes: null },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/work-sessions`,
    );
  });

  it("oturum listesi gövdesiz geldiğinde boş listeye iner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(readAssignmentWorkSessions(assignmentId)).resolves.toEqual([]);
  });

  it("tamamlamayı gövdesiz POST olarak gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({ id: assignmentId })));
    vi.stubGlobal("fetch", fetchMock);

    await completeAssignment(assignmentId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/complete`,
    );
    // Uç gövde beklemiyor; boş bir JSON gövdesi göndermek `Content-Type`
    // başlığını da beraberinde getirirdi.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: undefined });
  });
});
