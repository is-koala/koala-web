import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  readAssignmentTransport,
  readTransportPlan,
  readTransportPlanWrite,
  selectSeat,
  writeTransportPlan,
} from "./transport";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function notFound() {
  return jsonResponse(404, {
    success: false,
    httpStatus: 404,
    errorCode: "TRANSPORT_PLAN_NOT_FOUND",
    errorCategory: "RESOURCE_NOT_FOUND",
    message: "ham",
  });
}

describe("ulaşım BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("planı ilanın ucundan önbelleksiz okur; 404 ve eski sunucu null", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ outboundMethod: "SELF", returnMethod: "NONE", shuttles: [] })))
      .mockResolvedValueOnce(notFound());
    vi.stubGlobal("fetch", fetchMock);

    await expect(readTransportPlan(jobId)).resolves.toMatchObject({ outboundMethod: "SELF", shuttles: [] });
    await expect(readTransportPlan(jobId)).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/jobs/${jobId}/transport-plan`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("başka bir arızayı yutmaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, { success: false, httpStatus: 503, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "x" }),
      ),
    );

    await expect(readTransportPlan(jobId)).rejects.toMatchObject({ status: 503 });
  });

  it("planı PUT ile gövdeyle yazar ve yanıtı işveren görünümüne çevirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ outboundMethod: "SHUTTLE", returnMethod: "NONE", shuttles: [], updatedAt: "2026-09-15T09:00:00Z" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = { outboundMethod: "SHUTTLE" as const, returnMethod: "NONE" as const, allowanceAmount: null, allowanceNote: null, notes: null, shuttles: [] };

    await expect(writeTransportPlan(jobId, body)).resolves.toMatchObject({ updatedAt: "2026-09-15T09:00:00Z" });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/jobs/${jobId}/transport-plan`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", cache: "no-store" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
  });

  it("atamanın ulaşım görünümünü okur ve koltuğu seçer", async () => {
    const view = { outboundMethod: "SHUTTLE", returnMethod: "NONE", shuttles: [], seats: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(view)))
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(jsonResponse(200, envelope(view)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAssignmentTransport(assignmentId)).resolves.toMatchObject({ seats: [] });
    await expect(readAssignmentTransport(assignmentId)).resolves.toBeNull();
    const selection = { shuttleId: "cccccccc-cccc-4ccc-8ccc-000000000001", stopId: "cccccccc-cccc-4ccc-8ccc-000000000011" };
    await expect(selectSeat(assignmentId, selection)).resolves.toMatchObject({ outboundMethod: "SHUTTLE" });

    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/job-assignments/${assignmentId}/transport`);
    expect(fetchMock.mock.calls[2][0]).toBe(`https://api.example.test/job-assignments/${assignmentId}/transport/seat`);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "PUT", cache: "no-store" });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(selection);
  });
});

describe("form gövdesinden plan okuma", () => {
  const draft = {
    outboundMethod: "SHUTTLE",
    returnMethod: "NONE",
    allowanceAmount: "",
    allowanceNote: "",
    notes: "",
    shuttles: [
      {
        key: "shuttle-1",
        id: null,
        direction: "OUTBOUND",
        name: "Avrupa",
        plate: "",
        capacity: "8",
        driverName: "",
        driverPhone: "",
        stops: [{ key: "stop-1", id: null, label: "", scheduledAt: "2026-09-20T06:40", editingAddress: true }],
      },
    ],
  };
  const address = {
    countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
    cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
    districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53",
    components: { neighborhood: "Caferağa", thoroughfare: "Rıhtım Caddesi", buildingNumber: "1", postalCode: "34710" },
    position: { latitude: 40.9925, longitude: 29.0245, source: "USER_CONFIRMED_PIN" },
  };

  it("alan yoksa yok, JSON bozuksa geçersiz, adres eksikse alan hatası, tamamsa gövde", () => {
    expect(readTransportPlanWrite(new FormData())).toEqual({ status: "absent" });

    const broken = new FormData();
    broken.set("transportPlan", "{");
    expect(readTransportPlanWrite(broken)).toMatchObject({ status: "invalid" });

    const missing = new FormData();
    missing.set("transportPlan", JSON.stringify(draft));
    expect(readTransportPlanWrite(missing)).toEqual({
      status: "invalid",
      fieldErrors: { "shuttles[0].stops[0].address": "Durağın adresini onaylaman gerekiyor." },
    });

    const complete = new FormData();
    complete.set("transportPlan", JSON.stringify(draft));
    complete.set("transportAddress.stop-1", JSON.stringify(address));
    const read = readTransportPlanWrite(complete);
    expect(read.status).toBe("ready");
    if (read.status !== "ready") return;
    expect(read.body.shuttles[0].stops[0]).toEqual({
      label: null,
      scheduledAt: "2026-09-20T03:40:00Z",
      address,
    });
  });
});
