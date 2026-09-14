import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobApplicant } from "@/applications/employer-review";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  openApplicantConversation,
  readApplicantAssignments,
  readApplicantDossier,
  readJobApplicants,
  readTalentPool,
  readTalentPoolMembership,
  removeFromTalentPool,
  respondToApplication,
  saveToTalentPool,
} from "./employer-review";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const jobId = "11111111-1111-4111-8111-111111111111";
const workerId = "22222222-2222-4222-8222-222222222222";
const applicationId = "33333333-3333-4333-8333-333333333333";
const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("işveren başvuru inceleme backend modülü", () => {
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

  it("başvuru satırındaki jobTitle alanını adayın mesleği olarak taşır", async () => {
    // `JobApplicationMapper.java:26` bu alanı `user.jobTitle` üzerinden
    // dolduruyor: ilanın başlığı değil, adayın mesleği. Karta ilan başlığı
    // olarak basılırsa kullanıcı her kartta aynı yanlış metni okur.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: applicationId,
          status: "APPLIED",
          applicationDateTime: "2026-09-01T09:00:00Z",
          notes: "  Hafta sonu da çalışabilirim.  ",
          cvUrl: "https://cdn.example.test/cv.pdf",
          jobTitle: "Barista",
          applicant: {
            id: workerId,
            firstName: "Ayşe",
            lastName: "Yılmaz",
            username: "ayse",
            profilePictureUrl: "https://cdn.example.test/a.png",
          },
        },
      ])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readJobApplicants(jobId)).resolves.toEqual([
      {
        id: applicationId,
        status: "APPLIED",
        appliedAt: "2026-09-01T09:00:00Z",
        answeredAt: null,
        rejectionReason: null,
        assignmentId: null,
        notes: "Hafta sonu da çalışabilirim.",
        cvUrl: "https://cdn.example.test/cv.pdf",
        occupation: "Barista",
        applicant: {
          id: workerId,
          fullName: "Ayşe Yılmaz",
          profilePictureUrl: "https://cdn.example.test/a.png",
        },
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/jobs/${jobId}/applications`);
  });

  it("adı olmayan adayda kullanıcı adına düşer ve tanınmayan durumu UNKNOWN yapar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: applicationId,
          status: "SHORTLISTED",
          applicationDateTime: "2026-09-01T09:00:00Z",
          applicant: { id: workerId, username: "ayse" },
        },
      ])),
    ));

    const [applicant] = await readJobApplicants(jobId);

    expect(applicant.status).toBe("UNKNOWN");
    expect(applicant.applicant.fullName).toBe("ayse");
    expect(applicant.notes).toBeNull();
    expect(applicant.occupation).toBeNull();
  });

  it("gövdesiz başarılı yanıtı boş listeye indirir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(readJobApplicants(jobId)).resolves.toEqual([]);
  });

  it("aday dosyasını dört uçtan tek turda toplar ve puan özeti yoksa boş bırakır", async () => {
    // `ReviewsController.java:95` özet satırı yoksa `data`'ya `null` yazıyor;
    // bunu bir nesne sanmak aday panelini render sırasında düşürürdü.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: workerId,
        firstName: "Ayşe",
        lastName: "Yılmaz",
        username: "ayse",
        profilePictureUrl: null,
        jobTitle: "Barista",
        about: "  Beş yıl deneyim.  ",
        cityName: "İstanbul",
        districtName: "Kadıköy",
        cvUrl: "https://cdn.example.test/cv.pdf",
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [
          {
            id: "review-1",
            author: { id: "author-1", firstName: "Mehmet", lastName: "Demir", username: "mehmet" },
            rating: 5,
            comment: "Zamanında geldi.",
            anonymous: false,
            createdAt: "2026-08-01T10:00:00Z",
          },
          {
            id: "review-2",
            author: null,
            rating: 4,
            comment: null,
            anonymous: true,
            createdAt: "2026-07-01T10:00:00Z",
          },
        ],
        page: 0,
        size: 5,
        totalElements: 2,
        totalPages: 1,
        first: true,
        last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([
        { code: "GEZGIN", family: "GEZGIN", tier: "GOLD", name: "  Gezgin  ", description: "d", iconUrl: null, earnedAt: "2026-08-01T10:00:00Z" },
        { code: "KIMLIK", family: "IDENTITY", tier: "BILINMEYEN", name: null, description: null, iconUrl: null, earnedAt: null },
      ])));
    vi.stubGlobal("fetch", fetchMock);

    const dossier = await readApplicantDossier(workerId);

    expect(dossier.profile).toEqual({
      id: workerId,
      fullName: "Ayşe Yılmaz",
      profilePictureUrl: null,
      occupation: "Barista",
      about: "Beş yıl deneyim.",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      cvUrl: "https://cdn.example.test/cv.pdf",
    });
    expect(dossier.ratingSummary).toBeNull();
    expect(dossier.reviews).toEqual([
      {
        id: "review-1",
        authorName: "Mehmet Demir",
        rating: 5,
        comment: "Zamanında geldi.",
        createdAt: "2026-08-01T10:00:00Z",
      },
      {
        id: "review-2",
        authorName: null,
        rating: 4,
        comment: null,
        createdAt: "2026-07-01T10:00:00Z",
      },
    ]);
    // Rozetler `PublicProfileDto`'da yok, kendi ucundan geliyor. Tanınmayan
    // seviye `UNKNOWN`'a düşüyor ve adı boş olan rozet koduna yedekleniyor —
    // ikisi de ekranda boş bir çip olurdu.
    expect(dossier.badges).toEqual([
      { code: "GEZGIN", name: "Gezgin", tier: "GOLD" },
      { code: "KIMLIK", name: "KIMLIK", tier: "UNKNOWN" },
    ]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `https://api.example.test/users/${workerId}`,
      `https://api.example.test/users/${workerId}/rating-summary`,
      `https://api.example.test/users/${workerId}/reviews?page=0&size=5`,
      `https://api.example.test/users/${workerId}/badges`,
    ]);
  });

  it("rozet listesi gövdesiz gelirse aday panelini düşürmez", async () => {
    // Uç düz liste döndürüyor ama zarfın `data` alanı boş kalabiliyor;
    // `null`'ı liste sanmak paneli render sırasında düşürürdü.
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: workerId, username: "ayse" })))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null)))
      .mockResolvedValueOnce(jsonResponse(200, envelope(null))));

    await expect(readApplicantDossier(workerId)).resolves.toMatchObject({
      badges: [],
      reviews: [],
      ratingSummary: null,
    });
  });

  it("puan özetini sayısal alanlarıyla taşır", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: workerId, username: "ayse" })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        userId: workerId,
        reviewCount: 12,
        averageRating: "4.75",
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [], page: 0, size: 5, totalElements: 0, totalPages: 0, first: true, last: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([]))));

    const dossier = await readApplicantDossier(workerId);

    expect(dossier.ratingSummary).toEqual({ reviewCount: 12, averageRating: "4.75" });
  });

  it("yetenek havuzu üyeliğini bütün sayfalardan kimlik kümesi olarak toplar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{ id: "e1", worker: { id: workerId, username: "ayse" }, createdAt: "2026-08-01T00:00:00Z" }],
        page: 0, size: 100, totalElements: 2, totalPages: 2, first: true, last: false,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        content: [{ id: "e2", worker: { id: "other", username: "veli" }, createdAt: "2026-08-02T00:00:00Z" }],
        page: 1, size: 100, totalElements: 2, totalPages: 2, first: false, last: true,
      })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readTalentPoolMembership()).resolves.toEqual(new Set([workerId, "other"]));
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.example.test/users/me/talent-pool?page=0&size=100",
      "https://api.example.test/users/me/talent-pool?page=1&size=100",
    ]);
  });

  it("havuz listesini sayfalı olarak okur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [{
        id: "e1",
        worker: {
          id: workerId,
          firstName: "Ayşe",
          lastName: "Yılmaz",
          username: "ayse",
          profilePictureUrl: null,
        },
        note: "  Hızlı öğreniyor.  ",
        createdAt: "2026-08-01T00:00:00Z",
      }],
      page: 1, size: 20, totalElements: 21, totalPages: 2, first: false, last: true,
    }))));

    const pool = await readTalentPool(1);

    expect(pool.content).toEqual([
      {
        id: "e1",
        workerId,
        fullName: "Ayşe Yılmaz",
        profilePictureUrl: null,
        note: "Hızlı öğreniyor.",
        createdAt: "2026-08-01T00:00:00Z",
      },
    ]);
    expect(pool).toMatchObject({ page: 1, totalPages: 2, totalElements: 21 });
  });

  it("havuza eklemeyi PUT, çıkarmayı DELETE ile gönderir", async () => {
    // Yanıt gövdesi bir kez okunabildiği için her çağrı kendi `Response`'unu alır.
    const fetchMock = vi.fn((...args: unknown[]) => {
      void args;
      return Promise.resolve(jsonResponse(200, envelope(null)));
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveToTalentPool(workerId, "Hızlı öğreniyor.");
    await removeFromTalentPool(workerId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/users/me/talent-pool/${workerId}`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ note: "Hızlı öğreniyor." }),
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("notsuz eklemede gövdeye boş nesne koyar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await saveToTalentPool(workerId, "");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({}) });
  });

  it("kabulü redden ayrı bir gövdeyle gönderir ve atama kimliğini geri taşır", async () => {
    // `JobApplicationDetailDto.assignment` yalnız kabul yanıtında dolu ve
    // başvuru listesi ucu (`JobApplicantDto`) atama taşımıyor: kimlik burada
    // okunmazsa bu ekrandan bir daha okunamıyor.
    const assignmentId = "44444444-4444-4444-8444-444444444444";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({
        id: applicationId,
        status: "ACCEPTED",
        assignment: {
          id: assignmentId,
          status: "PENDING_CONFIRMATION",
          messagingAvailable: false,
          messagingAvailableReason: "PAYMENT_REQUIRED",
        },
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Kabul anında mesaj kapısı hep ödemeye kapalı (#157): kart, sunucu
    // listesi tazelenene kadar bu karardan ödeme yolunu çizer.
    await expect(
      respondToApplication({ applicationId, decision: "ACCEPTED", rejectionReason: "" }),
    ).resolves.toEqual({
      decision: "ACCEPTED",
      assignmentId,
      messaging: { available: false, reason: "PAYMENT_REQUIRED" },
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-applications/${applicationId}/respond`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ status: "ACCEPTED" }),
    });
  });

  it("kabul gövdesine red gerekçesi koymaz", async () => {
    // Sunucu alanı kabulde hiç okumuyor (`respondToApplication` onu yalnız
    // `else` dalında yazıyor); gönderilen bir gerekçe kaydı kirletirdi.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ id: applicationId, status: "ACCEPTED", assignment: null })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await respondToApplication({
      applicationId,
      decision: "ACCEPTED",
      rejectionReason: "yanlışlıkla yazıldı",
    });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({ status: "ACCEPTED" }),
    });
  });

  it("red gerekçesini kırpıp gövdeye koyar, atama beklemez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ id: applicationId, status: "REJECTED" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      respondToApplication({
        applicationId,
        decision: "REJECTED",
        rejectionReason: "  Deneyim aradığımız alanda değil.  ",
      }),
    ).resolves.toEqual({ decision: "REJECTED", assignmentId: null, messaging: null });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({
        status: "REJECTED",
        rejectionReason: "Deneyim aradığımız alanda değil.",
      }),
    });
  });

  it("kararı gönderilen değerden değil sunucunun yanıtından okur", async () => {
    // Sunucu son sözü söyleyen taraf: gönderilen değeri varsaymak, yanıtın
    // başka bir şey söylediği bir durumda ekrana yanlış kararı yazdırırdı.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ id: applicationId, status: "REJECTED" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      respondToApplication({ applicationId, decision: "ACCEPTED", rejectionReason: "" }),
    ).resolves.toMatchObject({ decision: "REJECTED" });
  });

  it("tanınmayan durumu kabule düşürmez", async () => {
    // Kabul dalı ekranda "tam iş adresi ona açıldı" yazıyor ve atama
    // bağlantısı çiziyor. Okunamayan bir durumu kabule saymak, ADR-0003
    // uyarınca geri alınamaz olan bir ifşanın **olduğunu iddia etmek** olurdu:
    // bu ekranın söyleyebileceği en pahalı yanlış.
    for (const status of ["SHORTLISTED", "APPLIED", "WITHDRAWN"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
        jsonResponse(200, envelope({ id: applicationId, status })),
      ));

      await expect(
        respondToApplication({ applicationId, decision: "ACCEPTED", rejectionReason: "" }),
      ).resolves.toMatchObject({ decision: "UNKNOWN" });
    }
  });

  it("durumu hiç gelmeyen yanıtta da kabul demez", async () => {
    // `data: null` ve alanı eksik gövde aynı yere düşüyor: ortada okunmuş bir
    // karar yok.
    for (const body of [null, { id: applicationId }, { id: applicationId, status: null }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(body))));

      await expect(
        respondToApplication({ applicationId, decision: "ACCEPTED", rejectionReason: "" }),
      ).resolves.toEqual({ decision: "UNKNOWN", assignmentId: null, messaging: null });
    }
  });

  it("409 kontenjan reddini kodu ile yukarı taşır", async () => {
    // Ekran metni `errorCode` ile seçiliyor; kod kaybolursa kart nötr yedeğe
    // düşer ve kullanıcı kontenjanın dolduğunu hiç okuyamaz.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        success: false,
        httpStatus: "CONFLICT",
        errorCode: "JOB_APPLICATION_JOB_HEADCOUNT_FULL",
        errorCategory: "CONFLICT",
        message: "Bu ilanın kontenjanı dolu.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      respondToApplication({ applicationId, decision: "ACCEPTED", rejectionReason: "" }),
    ).rejects.toMatchObject({
      status: 409,
      errorCode: "JOB_APPLICATION_JOB_HEADCOUNT_FULL",
    });
  });

  it("aday ile konuşmayı işçi kimliğini sorguya koyarak açar", async () => {
    // `MessagingManager.java:91` `workerId` verilmediğinde çağıranı işçi
    // sayıyor; işveren kendisiyle konuşurdu.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ id: "conversation-1", jobId, jobTitle: "Barista" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(openApplicantConversation(jobId, workerId)).resolves.toBe("conversation-1");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/jobs/${jobId}/conversation?workerId=${workerId}`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("ilanın atamalarını tek çağrıyla GET /jobs/{jobId}/assignments ucundan işçi kimliğiyle eşler", async () => {
    // Backend 0.9.23 ilanın atamalarını sahibe sayfalı veriyor; işverenin
    // bütün atamalarını tarayıp ilana göre elemeye gerek yok (#166). Aynı
    // işçinin iki atamasında en son kurulan kazanıyor — eski atamanın kapalı
    // sohbeti yeni atamanın kapısını anlatmıyor.
    const secondWorkerId = "55555555-5555-4555-8555-555555555555";
    const row = (overrides: Record<string, unknown>) => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      job: { id: jobId, title: "Barista", startDateTime: "2026-09-12T09:00:00", endDateTime: "2026-09-12T18:00:00" },
      worker: { id: workerId, firstName: "Ayşe", lastName: "Yılmaz" },
      status: "CONFIRMED",
      paymentStatus: "HELD_IN_ESCROW",
      assignmentDateTime: "2026-09-01T09:00:00Z",
      messagingAvailable: true,
      messagingAvailableReason: "AVAILABLE",
      ...overrides,
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      content: [
        row({}),
        row({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          assignmentDateTime: "2026-08-20T09:00:00Z",
          messagingAvailable: false,
          messagingAvailableReason: "CLOSED",
        }),
        row({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
          worker: { id: secondWorkerId, firstName: "Mehmet", lastName: "Kaya" },
          messagingAvailable: undefined,
          messagingAvailableReason: undefined,
        }),
      ],
      page: 0,
      size: 100,
      totalElements: 3,
      totalPages: 1,
      first: true,
      last: true,
    })));
    vi.stubGlobal("fetch", fetchMock);

    const assignments = await readApplicantAssignments(jobId, [
      acceptedApplicant("a1", workerId, null),
      acceptedApplicant("a2", secondWorkerId, "aaaaaaaa-aaaa-4aaa-8aaa-000000000004"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/jobs/${jobId}/assignments?page=0&size=100`,
    );
    expect([...assignments.values()]).toEqual([
      {
        workerId,
        assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        messaging: { available: true, reason: "AVAILABLE" },
      },
      {
        workerId: secondWorkerId,
        assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
        messaging: null,
      },
    ]);
  });

  it("kabul edilmiş aday yoksa atama ucuna hiç çıkmaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const assignments = await readApplicantAssignments(jobId, [
      { ...acceptedApplicant("a1", workerId, null), status: "APPLIED" },
    ]);

    expect(assignments.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ucu tanımayan eski sunucuda işverenin atama listesini tarar; başka 404'ü yutmaz", async () => {
    // Yalnız `ENDPOINT_NOT_FOUND` eski yola düşürüyor: sahibi olmadığı ilanın
    // 404'ü (`JOB_NOT_FOUND`) bir yol eksikliği değil, bir yetki cevabı.
    const otherJobId = "44444444-4444-4444-8444-444444444444";
    const endpointMissing = (code: string) => jsonResponse(404, {
      success: false,
      errorCode: code,
      errorCategory: code,
      message: "",
    });
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/jobs/${jobId}/assignments`)) {
        return Promise.resolve(endpointMissing("ENDPOINT_NOT_FOUND"));
      }
      if (url.includes("/users/me/assignments?asEmployer=true")) {
        return Promise.resolve(jsonResponse(200, envelope({
          content: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
              job: { id: jobId, title: "Barista", startDateTime: "2026-09-12T09:00:00", endDateTime: "2026-09-12T18:00:00" },
              worker: { id: workerId, firstName: "Ayşe", lastName: "Yılmaz" },
              status: "CONFIRMED",
              paymentStatus: "HELD_IN_ESCROW",
              assignmentDateTime: "2026-09-01T09:00:00Z",
              messagingAvailable: true,
              messagingAvailableReason: "AVAILABLE",
            },
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
              job: { id: otherJobId, title: "Garson", startDateTime: "2026-09-12T09:00:00", endDateTime: "2026-09-12T18:00:00" },
              worker: { id: workerId, firstName: "Ayşe", lastName: "Yılmaz" },
              status: "CONFIRMED",
              paymentStatus: "HELD_IN_ESCROW",
              assignmentDateTime: "2026-09-02T09:00:00Z",
            },
          ],
          page: 0, size: 100, totalElements: 2, totalPages: 1, first: true, last: true,
        })));
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const assignments = await readApplicantAssignments(jobId, [acceptedApplicant("a1", workerId, null)]);

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      `https://api.example.test/jobs/${jobId}/assignments?page=0&size=100`,
      "https://api.example.test/users/me/assignments?asEmployer=true&page=0&size=100",
    ]);
    expect([...assignments.values()]).toEqual([
      {
        workerId,
        assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        messaging: { available: true, reason: "AVAILABLE" },
      },
    ]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(endpointMissing("JOB_NOT_FOUND")));
    await expect(
      readApplicantAssignments(jobId, [acceptedApplicant("a1", workerId, null)]),
    ).rejects.toMatchObject({ errorCode: "JOB_NOT_FOUND" });
  });

  it("başvuru satırındaki yanıt zamanını, red gerekçesini ve atama kimliğini taşır; UUID olmayan kimliği düşürür", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: applicationId,
          status: "REJECTED",
          applicationDateTime: "2026-09-01T09:00:00Z",
          answeredDateTime: "2026-09-02T10:00:00Z",
          rejectionReason: "  Deneyim şartı karşılanmıyor.  ",
          assignmentId: "not-a-uuid",
          applicant: { id: workerId, firstName: "Ayşe", lastName: "Yılmaz" },
        },
      ])),
    ));

    const [applicant] = await readJobApplicants(jobId);

    expect(applicant).toMatchObject({
      answeredAt: "2026-09-02T10:00:00Z",
      rejectionReason: "Deneyim şartı karşılanmıyor.",
      assignmentId: null,
    });
  });
});

function acceptedApplicant(id: string, applicantId: string, assignmentId: string | null): JobApplicant {
  return {
    id,
    status: "ACCEPTED",
    appliedAt: "2026-09-01T09:00:00Z",
    answeredAt: null,
    rejectionReason: null,
    assignmentId,
    notes: null,
    cvUrl: null,
    occupation: null,
    applicant: { id: applicantId, fullName: "Aday", profilePictureUrl: null },
  };
}
