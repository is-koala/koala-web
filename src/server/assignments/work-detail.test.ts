import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  checkpoint,
  createAssignmentDispute,
  createAssignmentReview,
  cancelAssignment,
  readWorkDetail,
} from "./work-detail";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function assignmentDto(status = "IN_PROGRESS") {
  return {
    id: assignmentId,
    job: {
      id: jobId,
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      category: { name: "Etkinlik" },
      startDateTime: "2026-09-12T09:00:00",
      endDateTime: "2026-09-12T18:00:00",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      companyName: "Koala Etkinlik",
    },
    status,
    paymentStatus: "HELD_IN_ESCROW",
    assignmentDateTime: "2026-09-06T10:00:00Z",
    actualCompletionDateTime: null,
    pricing: { currency: "TRY", workerPayout: "1250.00" },
  };
}

function page(content: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    content,
    page: 0,
    size: 100,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
    ...overrides,
  };
}

describe("iş ayrıntısı BFF sözleşmesi", () => {
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

  it("atamayı kullanıcıya ait sayfalarda bulur; iş, adres, oturum ve iptal özetini dar modele toplar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(page([], { totalPages: 2, last: false }))))
      .mockResolvedValueOnce(jsonResponse(200, envelope(page([assignmentDto()], { page: 1, first: false }))))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: jobId,
        description: "Misafirleri karşıla.",
        duties: "Yaka kartlarını dağıt.",
        dressCode: "Siyah gömlek",
        addressPrecision: "EXACT",
        address: { displayAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4" },
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([
        {
          id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          jobAssignmentId: assignmentId,
          checkInAt: "2026-09-12T09:04:00Z",
          checkOutAt: null,
          checkInLatitude: 40.98,
          checkInLongitude: 29.02,
          minutes: null,
        },
      ])))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "1400.00",
        noticeMinutes: 120,
        cancellableNow: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkDetail(assignmentId);
    expect(result).toEqual({
      observedAt: expect.any(Number),
      assignment: {
        id: assignmentId,
        jobId,
        title: "Etkinlik görevlisi",
        position: "Karşılama",
        categoryName: "Etkinlik",
        companyName: "Koala Etkinlik",
        cityName: "İstanbul",
        districtName: "Kadıköy",
        startsAt: "2026-09-12T09:00:00",
        endsAt: "2026-09-12T18:00:00",
        status: "IN_PROGRESS",
        paymentStatus: "HELD_IN_ESCROW",
        workerPayout: "1250.00",
        currency: "TRY",
        assignedAt: "2026-09-06T10:00:00Z",
        completedAt: null,
      },
      description: "Misafirleri karşıla.",
      duties: "Yaka kartlarını dağıt.",
      dressCode: "Siyah gömlek",
      fullAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4",
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:04:00Z",
        checkOutAt: null,
        minutes: null,
      }],
      resolution: {
        cancellationPreview: {
          noticeMinutes: 120,
          cancellableNow: true,
        },
        cancellation: null,
        disputes: [],
      },
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.example.test/users/me/assignments?asEmployer=false&page=0&size=100",
      "https://api.example.test/users/me/assignments?asEmployer=false&page=1&size=100",
      `https://api.example.test/jobs/${jobId}`,
      `https://api.example.test/job-assignments/${assignmentId}/work-sessions`,
      `https://api.example.test/job-assignments/${assignmentId}/cancellation-preview`,
      `https://api.example.test/job-assignments/${assignmentId}/disputes`,
    ]);
    expect(JSON.stringify(result)).not.toContain("checkInLatitude");
    expect(JSON.stringify(result?.resolution)).not.toMatch(
      /feeRate|feeAmount|refundAmount/,
    );
  });

  it("yalnız boşluktan ibaret iş metinlerini ekrana boş dize olarak taşımaz", async () => {
    // Bu üç alan `clean` üzerinden geçiyor ve `clean` artık `@/server/api/dto`'da
    // paylaşılan bir fonksiyon. Yerel kopya silinince koruma da bu dosyadan
    // çıkmıştı: paylaşılan davranış başka bir çağıran için değiştirilirse
    // buradaki üç alan sessizce boş dize taşımaya başlardı.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(page([assignmentDto()]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: jobId,
        description: "   ",
        duties: "\n\t ",
        dressCode: "",
        addressPrecision: "EXACT",
        address: { displayAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4" },
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "1400.00",
        noticeMinutes: 120,
        cancellableNow: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkDetail(assignmentId);

    expect(result?.description).toBeNull();
    expect(result?.duties).toBeNull();
    expect(result?.dressCode).toBeNull();
  });

  it("backend kesin adresi artık döndürmüyorsa tarayıcı modeline adres koymaz", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(page([assignmentDto("COMPLETED")]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: jobId,
        addressPrecision: "DISTRICT",
        address: null,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkDetail(assignmentId);

    expect(result?.fullAddress).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("cancellation-preview"))).toBe(false);
  });

  it("kullanıcının atamalarında olmayan kimlik için başka ayrıntı uçlarına çıkmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([]))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkDetail(assignmentId)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("check-in/out için yalnız legacy koordinat gövdesini yollar ve #80 alanlarına bağlanmaz", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse(201, envelope({}))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await checkpoint(assignmentId, "check-in", { latitude: 40.98, longitude: 29.02 });
    await checkpoint(assignmentId, "check-out", null);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/check-in`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ latitude: 40.98, longitude: 29.02 }),
    });
    expect(fetchMock.mock.calls[0][1].body).not.toContain("clientEventId");
    expect(fetchMock.mock.calls[0][1].body).not.toContain("capturedAt");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  });

  it("iptal, uyuşmazlık ve değerlendirme isteklerini gerçek backend gövdeleriyle yollar", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse(201, envelope({}))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cancelAssignment(assignmentId, "Programım değişti");
    await createAssignmentDispute(assignmentId, "Çalışma süresi yanlış");
    await createAssignmentReview(assignmentId, 5, "İyi bir deneyimdi");

    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].body])).toEqual([
      [`https://api.example.test/job-assignments/${assignmentId}/cancel`, JSON.stringify({ reason: "Programım değişti" })],
      [`https://api.example.test/job-assignments/${assignmentId}/disputes`, JSON.stringify({ reason: "Çalışma süresi yanlış" })],
      [`https://api.example.test/job-assignments/${assignmentId}/reviews`, JSON.stringify({ rating: 5, comment: "İyi bir deneyimdi", anonymous: false })],
    ]);
  });
});
