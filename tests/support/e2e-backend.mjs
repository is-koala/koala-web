import { createServer } from "node:http";

const port = Number(process.argv[2]);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("E2E backend port must be a valid TCP port.");
}

const accountDeletionId = "bb58c5e0-e43b-4673-ae62-3525d4f7ec75";
const userId = "2592914e-b7f0-4b5f-a5d4-5c632daf2d96";
const expiredOpenJobId = "f62dc02c-70df-4e85-b1df-17b799ba17c1";
const openJobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const unpaidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61";
const paidAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f62";
const assignmentWorkerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
const jobCreatorId = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const assignmentPathPattern = /^\/job-assignments\/([0-9a-f-]{36})\/(payments|disputes|work-sessions|cancellation-preview)$/;
const fixtureManifestCreatedAt = new Date().toISOString();
const fixtureManifestExpiresAt = new Date(Date.now() + 3_600_000).toISOString();
const stateKeyPattern = /^[0-9a-f]{16}$/;
const states = new Map();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "GET" && url.pathname === "/__test__/health") {
    return json(response, 200, { ok: true });
  }
  if (request.method === "POST" && url.pathname === "/__test__/reset") {
    const key = stateKeyFrom(url);
    if (!key) return backendError(response, 400, "INVALID_TEST_KEY", "VALIDATION");
    states.set(key, {
      accountDeletion: null,
      accountDeletionRequests: [],
      jobGallery: [],
      applications: [],
      applicationRequests: [],
    });
    return json(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/__test__/requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.accountDeletionRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/application-requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.applicationRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }

  if (request.method === "GET" && url.pathname === `/jobs/${expiredOpenJobId}`) {
    return backendSuccess(response, expiredOpenJob());
  }
  if (request.method === "GET" && url.pathname === `/jobs/${openJobId}`) {
    return backendSuccess(response, openJob());
  }
  if (request.method === "GET" && url.pathname === `/users/${jobCreatorId}/employer-stats`) {
    // İlan sayfasının işveren güven kartı (is-koala/koala-web#166); uç herkese
    // açık ve değerler türetiliyor. `averageRating` BigDecimal → dize.
    return backendSuccess(response, {
      userId: jobCreatorId,
      jobsPosted: 12,
      completedJobs: 9,
      averageRating: "4.6",
      reviewCount: 7,
      memberSince: "2025-03-14T10:00:00Z",
    });
  }
  if (request.method === "GET" && url.pathname === "/jobs") {
    if (url.searchParams.get("query") === "__backend_failure__") {
      return backendError(response, 503, "TEST_BACKEND_UNAVAILABLE", "SERVICE_UNAVAILABLE");
    }
    return backendSuccess(response, {
      content: [openJobSummary()],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
  }
  if (request.method === "GET" && url.pathname === "/sitemap/jobs/manifest") {
    return backendSuccess(response, {
      version: "11111111-1111-4111-8111-111111111111",
      createdAt: fixtureManifestCreatedAt,
      expiresAt: fixtureManifestExpiresAt,
      entryCount: 0,
      shardSize: 50_000,
      shards: [],
    });
  }

  const state = authorizedState(request);
  if (!state) {
    return backendError(response, 401, "AUTHENTICATION_REQUIRED", "AUTHENTICATION");
  }

  if (request.method === "GET" && url.pathname === "/users/me") {
    return backendSuccess(response, {
      id: userId,
      firstName: "E2E",
      lastName: "Kullanıcı",
      email: "e2e@example.test",
      phoneNumber: "+905551112233",
      emailVerified: true,
      phoneVerified: true,
      profilePictureUrl: null,
      jobTitle: null,
      about: null,
      qualifications: null,
      interests: null,
      experiences: [],
      educations: [],
      isEmployer: false,
      identityVerified: true,
      maskedTcIdentityNumber: "*********11",
      address: { id: "address-placeholder" },
      companies: [],
    });
  }
  // Atamanın işçisinin aday dosyası (is-koala/koala-web#166): profil, puan
  // özeti, değerlendirmeler ve rozetler dört ayrı uçtan okunuyor.
  if (request.method === "GET" && url.pathname === `/users/${assignmentWorkerId}`) {
    return backendSuccess(response, {
      id: assignmentWorkerId,
      firstName: "Ayşe",
      lastName: "Yılmaz",
      username: "ayse",
      profilePictureUrl: null,
      jobTitle: "Garson",
      about: "Beş yıldır etkinliklerde çalışıyorum.",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      cvUrl: null,
    });
  }
  if (request.method === "GET" && url.pathname === `/users/${assignmentWorkerId}/rating-summary`) {
    return backendSuccess(response, { reviewCount: 3, averageRating: "4.7" });
  }
  if (request.method === "GET" && url.pathname === `/users/${assignmentWorkerId}/reviews`) {
    return backendSuccess(response, {
      content: [
        {
          id: "review-1",
          author: { id: userId, firstName: "E2E", lastName: "Kullanıcı" },
          rating: 5,
          comment: "Dakik ve güler yüzlü.",
          anonymous: false,
          createdAt: "2026-08-01T10:00:00Z",
        },
      ],
      page: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
  }
  if (request.method === "GET" && url.pathname === `/users/${assignmentWorkerId}/badges`) {
    return backendSuccess(response, [{ code: "PUNCTUAL", name: "Dakik", tier: "GOLD" }]);
  }
  if (request.method === "GET" && url.pathname === "/users/me/bank-accounts") {
    return backendSuccess(response, []);
  }
  if (request.method === "GET" && url.pathname === `/users/${userId}/availability`) {
    return backendSuccess(response, { slots: [], exceptions: [] });
  }
  if (request.method === "GET" && url.pathname === "/reference/universities") {
    return backendSuccess(response, []);
  }
  if (request.method === "GET" && url.pathname === "/users/me/payouts") {
    // Tek ödeme çıkışı; satır iş adını taşımıyor, web onu atama listesinden
    // `jobAssignmentId` ile eşler (is-koala/koala-web#165).
    return backendSuccess(response, [
      {
        id: "7e1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f70",
        jobAssignmentId: paidAssignmentId,
        amount: "1250.00",
        currency: "TRY",
        status: "PENDING",
        failureReason: null,
        completedAt: null,
        createdAt: "2026-09-10T09:00:00Z",
      },
    ]);
  }

  /*
   * Kritik yol (is-koala/koala-web#154): kayıtlı çalışan ilan bulur, başvurur,
   * başvurusunu görür. Başvuru test anahtarının durumunda birikir; ikinci
   * başvuru backend gibi 409 ile reddedilir.
   */
  if (request.method === "POST" && url.pathname === `/jobs/${openJobId}/applications`) {
    const body = await readJson(request);
    state.applicationRequests.push({
      method: request.method,
      path: url.pathname,
      body,
      authorization: request.headers.authorization,
      deviceId: request.headers["x-device-id"],
    });
    if (state.applications.some((application) => application.job.id === openJobId)) {
      return backendError(response, 409, "JOB_APPLICATION_ALREADY_EXISTS", "CONFLICT");
    }
    const job = openJobSummary();
    const application = {
      id: `cccccccc-cccc-4ccc-8ccc-${String(state.applications.length + 1).padStart(12, "0")}`,
      job: {
        id: job.id,
        title: job.title,
        position: job.position,
        companyName: job.companyName,
        cityName: job.cityName,
        districtName: job.districtName,
        startDateTime: job.startDateTime,
        coverImageUrl: null,
      },
      status: "APPLIED",
      notes: body?.notes ?? null,
      rejectionReason: null,
      applicationDateTime: "2026-09-14T10:00:00Z",
      answeredDateTime: null,
      assignmentId: null,
    };
    state.applications.push(application);
    return json(response, 201, {
      success: true,
      httpStatus: "CREATED",
      timeStamp: "2026-09-09T12:00:00Z",
      data: application,
    });
  }
  if (request.method === "GET" && url.pathname === "/users/me/applications") {
    const status = url.searchParams.get("status");
    const content = state.applications.filter(
      (application) => status === null || application.status === status,
    );
    return backendSuccess(response, {
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : 1,
      first: true,
      last: true,
    });
  }
  if (request.method === "GET" && url.pathname === "/users/me/notifications") {
    return backendSuccess(response, {
      notifications: {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      },
      unreadCount: 0,
    });
  }
  if (request.method === "GET" && url.pathname === "/users/me/notification-preferences") {
    return backendSuccess(response, []);
  }
  if (request.method === "GET" && url.pathname === "/users/me/sessions") {
    return backendSuccess(response, []);
  }
  if (request.method === "GET" && url.pathname === "/users/me/assignments") {
    // Aynı iki atama iki kabuğa da servis edilir: `asEmployer=true` işveren
    // ayrıntısını, `asEmployer=false` çalışan iş ayrıntısını besler. Mesaj
    // kapısı `messagingAvailable` ile satırdan okunur (is-koala/koala-web#157).
    const content = Number(url.searchParams.get("page") ?? 0) === 0 ? assignments() : [];
    return backendSuccess(response, {
      content,
      page: Number(url.searchParams.get("page") ?? 0),
      size: Number(url.searchParams.get("size") ?? 20),
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true,
    });
  }
  if (request.method === "GET" && url.pathname === `/jobs/${openJobId}/assignments`) {
    // Backend 0.9.23: ilanın atamaları sahibe sayfalı; aday kartının mesaj
    // kapısı buradan okunur (is-koala/koala-web#166).
    return backendSuccess(response, {
      content: assignments(),
      page: 0,
      size: Number(url.searchParams.get("size") ?? 20),
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true,
    });
  }
  const assignmentMatch = assignmentPathPattern.exec(url.pathname);
  if (request.method === "GET" && assignmentMatch) {
    // Emanete alınmış atamanın tek başarılı denemesi; çalışan çizelgesi
    // "Ödeme emanete alındı" satırını bunun `completedAt`'inden kurar.
    if (assignmentMatch[2] === "payments" && assignmentMatch[1] === paidAssignmentId) {
      return backendSuccess(response, [
        {
          id: "8e1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f71",
          status: "SUCCEEDED",
          currency: "TRY",
          workerPayout: "1250.00",
          commissionRate: "0.20",
          commissionAmount: "250.00",
          totalCharged: "1500.00",
          pricing: openJob().pricing,
          failureReason: null,
          completedAt: "2026-09-02T14:30:00Z",
          createdAt: "2026-09-02T14:29:00Z",
        },
      ]);
    }
    if (assignmentMatch[2] === "cancellation-preview") {
      return backendSuccess(response, {
        feeRate: "0.00",
        feeAmount: "0.00",
        refundAmount: "1500.00",
        noticeMinutes: 4_320,
        cancellableNow: true,
      });
    }
    return backendSuccess(response, []);
  }
  if (request.method === "GET" && url.pathname === "/conversations") {
    return backendSuccess(response, {
      content: [],
      page: 0,
      totalPages: 0,
      totalElements: 0,
      last: true,
    });
  }
  if (url.pathname === "/legal/account-deletion" && request.method === "GET") {
    return state.accountDeletion
      ? backendSuccess(response, state.accountDeletion)
      : backendError(response, 404, "LEGAL_DELETION_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (url.pathname === "/legal/account-deletion" && request.method === "POST") {
    const body = await readJson(request);
    state.accountDeletionRequests.push({
      method: request.method,
      path: url.pathname,
      body,
      authorization: request.headers.authorization,
      deviceId: request.headers["x-device-id"],
    });
    state.accountDeletion = {
      id: accountDeletionId,
      subjectId: userId,
      status: "REQUESTED",
      requestedAt: "2026-09-09T12:00:00Z",
      processedAt: null,
      blockedReason: null,
    };
    return backendSuccess(response, state.accountDeletion);
  }

  if (url.pathname === `/jobs/${openJobId}/images`) {
    if (request.method === "GET") {
      return backendSuccess(response, galleryOf(state));
    }
    if (request.method === "POST") {
      await drain(request);
      const images = galleryOf(state);
      const id = nextGalleryId(images.length);
      images.push({
        id,
        url: `https://cdn.example.test/${id}.webp`,
        caption: null,
        cover: images.length === 0,
        sortOrder: images.length,
      });
      return backendSuccess(response, images);
    }
    if (request.method === "PUT") {
      const body = await readJson(request);
      const current = galleryOf(state);
      const requested = Array.isArray(body?.images) ? body.images : [];
      const next = requested.map((entry, index) => {
        const existing = current.find((image) => image.id === entry.imageId);
        return {
          id: entry.imageId,
          url: existing?.url ?? `https://cdn.example.test/${entry.imageId}.webp`,
          caption: entry.caption ?? null,
          cover: entry.cover === true,
          sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
        };
      });
      if (next.length > 0 && !next.some((image) => image.cover)) next[0].cover = true;
      state.jobGallery = next;
      return backendSuccess(response, next);
    }
  }

  return backendError(response, 404, "RESOURCE_NOT_FOUND", "RESOURCE_NOT_FOUND");
});

server.listen(port, "127.0.0.1");

process.once("SIGTERM", () => server.close());
process.once("SIGINT", () => server.close());

function stateKeyFrom(url) {
  const key = url.searchParams.get("key");
  return key && stateKeyPattern.test(key) ? key : null;
}

function stateFrom(url) {
  const key = stateKeyFrom(url);
  return key ? states.get(key) : null;
}

function authorizedState(request) {
  if (request.headers["x-device-id"] !== "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e") return null;
  const match = /^Bearer access-([0-9a-f]{16})$/.exec(request.headers.authorization ?? "");
  return match ? states.get(match[1]) : null;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

async function drain(request) {
  for await (const chunk of request) {
    void chunk;
  }
}

function galleryOf(state) {
  if (!Array.isArray(state.jobGallery)) state.jobGallery = [];
  return state.jobGallery;
}

function nextGalleryId(index) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`;
}

function backendSuccess(response, data) {
  return json(response, 200, {
    success: true,
    httpStatus: "OK",
    timeStamp: "2026-09-09T12:00:00Z",
    data,
  });
}

function expiredOpenJob() {
  return {
    id: expiredOpenJobId,
    title: "Süresi dolmuş etkinlik görevlisi",
    description: "Bu ilan yalnız arama motoru hijyeni kabulünde kullanılır.",
    duties: "Etkinlik alanında yönlendirme",
    dressCode: null,
    category: { name: "Etkinlik" },
    company: null,
    creator: { firstName: "Ayşe", lastName: "Yıldız" },
    type: "ONE_TIME",
    salaryType: "DAILY",
    startDateTime: "2026-09-08T09:00:00",
    endDateTime: "2026-09-08T18:00:00",
    createdAt: "2026-08-30T07:15:00Z",
    pricing: null,
    minAge: 18,
    maxAge: 45,
    insuranceRequired: true,
    experienceRequired: false,
    headcount: 2,
    hiredCount: 0,
    images: [],
    address: { cityName: "İstanbul", districtName: "Kadıköy" },
    addressPrecision: "APPROXIMATE",
    status: "OPEN",
    acceptingApplications: false,
  };
}

function openJob() {
  return {
    id: openJobId,
    title: "Etkinlik görevlisi",
    description: "Festival alanında misafirleri karşıla.",
    duties: "Bilet kontrolü ve yönlendirme",
    dressCode: "Siyah kıyafet",
    category: { id: "category-1", name: "Etkinlik", code: "EVENT" },
    employerType: "COMPANY",
    company: { name: "Koala Etkinlik", logoUrl: null, website: "https://koala.example" },
    creator: { id: jobCreatorId, firstName: "Ayşe", lastName: "Yıldız" },
    type: "ONE_TIME",
    salaryType: "DAILY",
    startDateTime: "2026-09-20T09:00:00",
    endDateTime: "2026-09-20T18:00:00",
    createdAt: "2026-08-30T07:15:00Z",
    pricing: {
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.20",
      serviceFeeAmount: "250.00",
      employerTotal: "1500.00",
    },
    minAge: 18,
    maxAge: 45,
    insuranceRequired: true,
    experienceRequired: false,
    headcount: 4,
    hiredCount: 1,
    images: [],
    address: { cityName: "İstanbul", districtName: "Kadıköy" },
    addressPrecision: "APPROXIMATE",
    status: "OPEN",
    acceptingApplications: true,
  };
}

/**
 * Ödemesi bekleyen ve emanete alınmış birer atama. `messagingAvailable`
 * kararı backend'den geldiği gibi taşınır; web onu `paymentStatus`tan
 * türetmez, o yüzden iki satırın ikisi de kararı açıkça yazıyor.
 */
function assignments() {
  const job = openJob();
  const base = {
    job: {
      id: job.id,
      title: job.title,
      position: "Karşılama",
      category: job.category,
      employerType: job.employerType,
      startDateTime: job.startDateTime,
      endDateTime: job.endDateTime,
      cityName: job.address.cityName,
      districtName: job.address.districtName,
      companyName: job.company.name,
    },
    worker: { id: assignmentWorkerId, firstName: "Ayşe", lastName: "Yılmaz" },
    assignmentDateTime: "2026-09-01T09:00:00Z",
    actualCompletionDateTime: null,
    workHours: 0,
    workerPayout: "1250.00",
    totalCharged: "1500.00",
    pricing: job.pricing,
  };
  return [
    {
      ...base,
      id: unpaidAssignmentId,
      status: "PENDING_CONFIRMATION",
      paymentStatus: "PENDING_COLLECTION",
      messagingAvailable: false,
      messagingAvailableReason: "PAYMENT_REQUIRED",
    },
    {
      ...base,
      id: paidAssignmentId,
      status: "CONFIRMED",
      paymentStatus: "HELD_IN_ESCROW",
      messagingAvailable: true,
      messagingAvailableReason: "AVAILABLE",
    },
  ];
}

function openJobSummary() {
  const job = openJob();
  return {
    id: job.id,
    title: job.title,
    position: "Karşılama",
    sector: "Etkinlik",
    category: job.category,
    employerType: "COMPANY",
    type: job.type,
    salaryType: job.salaryType,
    salary: "1250.00",
    pricing: job.pricing,
    insuranceRequired: job.insuranceRequired,
    experienceRequired: job.experienceRequired,
    startDateTime: job.startDateTime,
    endDateTime: job.endDateTime,
    status: job.status,
    cityName: job.address.cityName,
    districtName: job.address.districtName,
    companyName: job.company.name,
    coverImageUrl: null,
    applicationCount: 4,
    headcount: job.headcount,
    hiredCount: job.hiredCount,
    latitude: 40.99,
    longitude: 29.03,
    addressPrecision: job.addressPrecision,
  };
}

function backendError(response, status, errorCode, errorCategory) {
  return json(response, status, {
    success: false,
    httpStatus: status,
    errorCode,
    errorCategory,
    message: "E2E backend error",
    timeStamp: "2026-09-09T12:00:00Z",
  });
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
