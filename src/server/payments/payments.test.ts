import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  createPaymentSession,
  readAllEmployerAssignments,
  readEmployerPaymentCompany,
  readPaymentDetailsForAssignment,
  readEmployerAssignments,
  readPaymentReconciliation,
  readPaymentAttempts,
} from "./payments";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const backendAssignment = {
  id: assignmentId,
  job: {
    id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    title: "Etkinlik görevlisi",
    position: "Karşılama",
    employerType: "INDIVIDUAL",
    startDateTime: "2026-09-12T09:00:00",
    endDateTime: "2026-09-12T18:00:00",
    cityName: "İstanbul",
    districtName: "Kadıköy",
  },
  worker: { firstName: "Ayşe", lastName: "Yılmaz" },
  status: "CONFIRMED",
  paymentStatus: "PENDING_COLLECTION",
  pricing: {
    pricingVersion: "2026-09-v1",
    currency: "TRY",
    workerPayout: "1500.50",
    serviceFeeRate: "0.075",
    serviceFeeAmount: "112.54",
    employerTotal: "1613.04",
  },
};

function assignmentPage(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    first: true,
    last: true,
  };
}

describe("işveren ödeme BFF sözleşmesi", () => {
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

  it("işveren atamalarını backend'in işveren görünümünden okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([backendAssignment]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await readEmployerAssignments();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=true&page=0&size=20",
    );
    expect(result.content[0]).toMatchObject({
      id: assignmentId,
      title: "Etkinlik görevlisi",
      workerName: "Ayşe Yılmaz",
      status: "CONFIRMED",
      paymentStatus: "PENDING_COLLECTION",
      pricing: backendAssignment.pricing,
    });
  });

  it("atama satırının takip alanlarını da taşır", async () => {
    // İşveren için tek atama getiren bir uç yok: ayrıntı ekranı da bu listeden
    // besleniyor. Zaman çizelgesi ve çalışılan saat buradan gelmezse ayrıntı
    // ekranı için ikinci bir kaynak uydurmak gerekirdi.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([{
        ...backendAssignment,
        assignmentDateTime: "2026-09-01T09:00:00Z",
        actualCompletionDateTime: "2026-09-03T18:00:00Z",
        workHours: 9,
      }]))),
    ));

    const result = await readEmployerAssignments();

    expect(result.content[0]).toMatchObject({
      assignedAt: "2026-09-01T09:00:00Z",
      completedAt: "2026-09-03T18:00:00Z",
      workHours: 9,
    });
  });

  it("mesaj kapısını ve işçi kimliğini atama satırından taşır", async () => {
    // Kapı `messagingAvailable` + `messagingAvailableReason`
    // (is-koala/koala-backend#257); işçi kimliği işverenin konuşma açarken
    // `workerId` olarak göndermek zorunda olduğu değer. Alan gelmezse karar
    // `null`: ekran düğmeyi hiç çizmez, "kapalı" da demez.
    const workerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([
        {
          ...backendAssignment,
          worker: { id: workerId, firstName: "Ayşe", lastName: "Yılmaz" },
          messagingAvailable: false,
          messagingAvailableReason: "PAYMENT_REQUIRED",
        },
        { ...backendAssignment, id: "7e3d1f69-3a1b-4c2f-8d4e-8b9c0d1e2f3a" },
      ]))),
    ));

    const result = await readEmployerAssignments();

    expect(result.content[0]).toMatchObject({
      workerId,
      workerName: "Ayşe Yılmaz",
      messaging: { available: false, reason: "PAYMENT_REQUIRED" },
    });
    expect(result.content[1]).toMatchObject({ workerId: "", messaging: null });
  });

  it("takip alanları gelmediğinde sıfır ve boş değere iner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([backendAssignment]))),
    ));

    const result = await readEmployerAssignments();

    expect(result.content[0]).toMatchObject({
      assignedAt: null,
      completedAt: null,
      workHours: 0,
    });
  });

  it("güvenlik sayfa sınırına gelince atama koleksiyonunu eksik diye işaretler", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return Promise.resolve(jsonResponse(200, envelope({
        content: page === 0 ? [backendAssignment] : [],
        page,
        size: 100,
        totalElements: 10_001,
        totalPages: 101,
        first: page === 0,
        last: false,
      })));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAllEmployerAssignments()).resolves.toMatchObject({
      assignments: [{ id: assignmentId }],
      totalsComplete: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });

  it("ödeme oturumunu yalnız atama kimliğiyle başlatır ve tokenı tarayıcı modeline çıkarmaz", async () => {
    const session = {
      paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=token&lang=tr",
      token: "provider-secret-token",
      pricing: backendAssignment.pricing,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(session)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentSession(assignmentId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payment-session`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(result).toEqual({
      paymentPageUrl: session.paymentPageUrl,
      pricing: backendAssignment.pricing,
    });
    expect(result).not.toHaveProperty("token");
  });

  it("atamanın ödeme denemelerini yeni en üstteki backend listesinden taşır", async () => {
    const attempts = [{
      id: "2f1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61",
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      commissionRate: "0.075",
      commissionAmount: "112.54",
      totalCharged: "1613.04",
      failureReason: "provider internal detail",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
    }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(attempts)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readPaymentAttempts(assignmentId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payments`,
    );
    expect(result).toEqual([{
      id: attempts[0].id,
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
      failureMessage:
        "Ödeme sağlayıcısı bu deneme için ek kontrol gerektirdi. Kartını ve banka doğrulamasını kontrol edebilirsin.",
    }]);
    expect(result[0]).not.toHaveProperty("failureReason");
    expect(JSON.stringify(result)).not.toContain("provider internal detail");
  });

  it("sayısal ödeme denemesi tutarını kesin para sözleşmesi diye kabul etmez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope([{
      id: "2f1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61",
      status: "FAILED",
      currency: "TRY",
      workerPayout: 9007199254740994,
      commissionRate: "0.075",
      commissionAmount: "112.54",
      totalCharged: "1613.04",
      createdAt: "2026-09-06T18:00:00Z",
    }])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPaymentAttempts(assignmentId))
      .rejects.toThrow("paymentAttempt.workerPayout must be an exact decimal string");
  });

  it("ödeme sonucunu hem atamanın hem denemelerin backend durumundan mutabıklaştırır", async () => {
    const settledAssignment = {
      ...backendAssignment,
      paymentStatus: "HELD_IN_ESCROW",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(assignmentPage([settledAssignment]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "attempt-1",
        status: "SUCCEEDED",
        pricing: backendAssignment.pricing,
        createdAt: "2026-09-06T18:00:00Z",
      }])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readPaymentReconciliation(assignmentId);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=true&page=0&size=100",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payments`,
    );
    expect(result).toMatchObject({
      assignment: { id: assignmentId, paymentStatus: "HELD_IN_ESCROW" },
      resolution: "held",
      hasActiveDispute: false,
    });
  });

  it("atama önceki hatayı taşısa da en yeni ödeme denemesi sonuçlanmadıysa bekler", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(assignmentPage([{
        ...backendAssignment,
        paymentStatus: "FAILED",
      }]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "attempt-retry",
        status: "IN_REVIEW",
        pricing: backendAssignment.pricing,
        createdAt: "2026-09-06T19:00:00Z",
      }, {
        id: "attempt-failed",
        status: "FAILED",
        pricing: backendAssignment.pricing,
        createdAt: "2026-09-06T18:00:00Z",
      }])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPaymentReconciliation(assignmentId)).resolves.toMatchObject({
      resolution: "pending",
      attempts: [{ status: "IN_REVIEW" }, { status: "FAILED" }],
    });
  });

  it("işveren ayrıntısında aktif dispute durumunu ödeme geçmişiyle birlikte okur", async () => {
    const assignment = await readEmployerAssignmentFixture();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope([])))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{ status: "OPEN" }])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPaymentDetailsForAssignment(assignment)).resolves.toMatchObject({
      hasActiveDispute: true,
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `https://api.example.test/job-assignments/${assignmentId}/payments`,
      `https://api.example.test/job-assignments/${assignmentId}/disputes`,
    ]);
  });

  it("ownership bulunmazsa ödeme ve dispute uçlarına çıkmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPaymentReconciliation(assignmentId)).resolves.toEqual({
      assignment: null,
      attempts: [],
      resolution: "pending",
      hasActiveDispute: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("şirket ödeme kapısı için ilan şirketinin kimlik ve adres varlığını okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      company: { id: "company-1", address: { id: "address-1" } },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readEmployerPaymentCompany(backendAssignment.job.id)).resolves.toEqual({
      companyId: "company-1",
      hasAddress: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/jobs/${backendAssignment.job.id}`,
    );
  });

  it.each([
    ["RELEASED_TO_WORKER", "released"],
    ["REFUNDED", "pending"],
  ])("%s durumunu emanette sonucu ile karıştırmaz", async (paymentStatus, resolution) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(assignmentPage([{
        ...backendAssignment,
        paymentStatus,
      }]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPaymentReconciliation(assignmentId)).resolves.toMatchObject({ resolution });
  });
});

async function readEmployerAssignmentFixture() {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse(200, envelope(assignmentPage([backendAssignment]))),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await readEmployerAssignments();
  return result.content[0];
}
