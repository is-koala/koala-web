import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readWorkerPayouts } from "./payouts";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function assignmentRow(id: string, title: string, companyName: string | null) {
  return {
    id,
    job: {
      id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      title,
      companyName,
      startDateTime: "2026-09-12T09:00:00",
      endDateTime: "2026-09-12T18:00:00",
    },
    status: "COMPLETED",
    paymentStatus: "RELEASED_TO_WORKER",
    pricing: { currency: "TRY", workerPayout: "1000.10" },
  };
}

describe("işçi ödeme çıkışları BFF sözleşmesi", () => {
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

  it("sunucunun sıralı listesini finansal alanları değiştirmeden taşır; iş adı atama listesinden eşlenir", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope([
        {
          id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          amount: "1000.10",
          currency: "TRY",
          status: "FAILED",
          failureReason: "IBAN sahibi eşleşmedi",
          completedAt: null,
          createdAt: "2026-09-05T10:30:00Z",
        },
        {
          id: "c1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          jobAssignmentId: "d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          amount: "250.00",
          currency: "TRY",
          status: "PROVIDER_PENDING",
          failureReason: " ",
          completedAt: null,
          createdAt: "2026-09-04T08:00:00Z",
        },
      ])))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [assignmentRow("b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e", "Etkinlik görevlisi", "Koala Etkinlik")],
        page: 0,
        size: 100,
        totalElements: 101,
        totalPages: 2,
        first: true,
        last: false,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [assignmentRow("d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e", "Depo sayımı", null)],
        page: 1,
        size: 100,
        totalElements: 101,
        totalPages: 2,
        first: false,
        last: true,
      })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkerPayouts();

    expect(result).toEqual([
      {
        id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        assignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        amount: "1000.10",
        currency: "TRY",
        status: "FAILED",
        failureMessage: "Banka aktarımı tamamlanamadı. Ödeme hesabını kontrol edip destekten yardım alabilirsin.",
        completedAt: null,
        createdAt: "2026-09-05T10:30:00Z",
        jobTitle: "Etkinlik görevlisi",
        employerName: "Koala Etkinlik",
        maskedIban: null,
        providerReference: null,
        releasedAt: null,
        settledAt: null,
      },
      {
        id: "c1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        assignmentId: "d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        amount: "250.00",
        currency: "TRY",
        status: "UNKNOWN",
        failureMessage: null,
        completedAt: null,
        createdAt: "2026-09-04T08:00:00Z",
        jobTitle: "Depo sayımı",
        employerName: null,
        maskedIban: null,
        providerReference: null,
        releasedAt: null,
        settledAt: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("IBAN sahibi eşleşmedi");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.example.test/users/me/payouts",
      "https://api.example.test/users/me/assignments?asEmployer=false&page=0&size=100",
      "https://api.example.test/users/me/assignments?asEmployer=false&page=1&size=100",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("backend satıra iş adını yazıyorsa atama listesini hiç okumaz", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, envelope([{
      id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      amount: "1000.10",
      currency: "TRY",
      status: "COMPLETED",
      completedAt: "2026-09-05T11:00:00Z",
      createdAt: "2026-09-05T10:30:00Z",
      jobTitle: " Etkinlik görevlisi ",
      companyName: "Koala Etkinlik",
    }])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkerPayouts();

    expect(result[0]).toMatchObject({ jobTitle: "Etkinlik görevlisi", employerName: "Koala Etkinlik" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("atama listesi okunamazsa kazançları iş adı olmadan yine döndürür; eşleşmeyen satır null kalır", async () => {
    const payoutRows = [
      {
        id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        amount: "1000.10",
        currency: "TRY",
        status: "COMPLETED",
        completedAt: "2026-09-05T11:00:00Z",
        createdAt: "2026-09-05T10:30:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(payoutRows)))
      .mockResolvedValueOnce(jsonResponse(503, {
        success: false,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "backend down",
        httpStatus: 503,
        timeStamp: "2026-09-12T10:00:00Z",
      })));
    const degraded = await readWorkerPayouts();
    expect(degraded[0]).toMatchObject({ amount: "1000.10", jobTitle: null, employerName: null });

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(payoutRows)))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [assignmentRow("e1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e", "Başka iş", null)],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      }))));
    const unmatched = await readWorkerPayouts();
    expect(unmatched[0]).toMatchObject({ jobTitle: null, employerName: null });
  });

  it("0.9.25 hakediş ayrıntısını taşır: maskeli IBAN, sağlayıcı referansı, çıkış ve mutabakat anları; hesap kimliği sınırı geçmez", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, envelope([
      {
        id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        jobTitle: "Etkinlik görevlisi",
        companyName: null,
        maskedIban: " TR18***2315 ",
        bankAccountId: "c9f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        providerReference: "IYZ-7F3A9C",
        amount: "1000.10",
        currency: "TRY",
        status: "COMPLETED",
        failureReason: null,
        releasedAt: "2026-09-05T10:30:00Z",
        settledAt: "2026-09-06T08:00:00Z",
        completedAt: "2026-09-06T08:00:00Z",
        createdAt: "2026-09-05T10:30:00Z",
      },
      {
        // Hesap sonradan silinmiş, sağlayıcı henüz onaylamamış: ikisi de null.
        id: "c1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        jobAssignmentId: "d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        jobTitle: "Depo sayımı",
        companyName: "Koala Lojistik",
        maskedIban: null,
        bankAccountId: null,
        providerReference: null,
        amount: "250.00",
        currency: "TRY",
        status: "PENDING",
        releasedAt: "2026-09-07T10:30:00Z",
        settledAt: null,
        completedAt: null,
        createdAt: "2026-09-07T10:30:00Z",
      },
    ])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkerPayouts();

    expect(result[0]).toMatchObject({
      maskedIban: "TR18***2315",
      providerReference: "IYZ-7F3A9C",
      releasedAt: "2026-09-05T10:30:00Z",
      settledAt: "2026-09-06T08:00:00Z",
    });
    expect(result[1]).toMatchObject({
      maskedIban: null,
      providerReference: null,
      releasedAt: "2026-09-07T10:30:00Z",
      settledAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("c9f0d24c");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("boş backend verisini boş listeye çevirir ve atama listesine çıkmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkerPayouts()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sayısal payout tutarını kesin para sözleşmesi diye kabul etmez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope([{
      id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      amount: 9007199254740994,
      currency: "TRY",
      status: "COMPLETED",
      createdAt: "2026-09-05T10:30:00Z",
    }]))));

    await expect(readWorkerPayouts())
      .rejects.toThrow("payout.amount must be an exact decimal string");
  });
});
