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
const completedAssignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f63";
const assignmentWorkerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
const jobCreatorId = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const assignmentPathPattern = /^\/job-assignments\/([0-9a-f-]{36})\/(payments|disputes|work-sessions|cancellation-preview)$/;
const reviewPathPattern = /^\/job-assignments\/([0-9a-f-]{36})\/reviews$/;
const workerIdentityPathPattern = /^\/job-assignments\/([0-9a-f-]{36})\/worker-identity$/;
const assignmentTransportPathPattern = /^\/job-assignments\/([0-9a-f-]{36})\/transport(\/seat)?$/;
// Ulaşım planı (is-koala/koala-web#187, backend 0.9.28). Fikstür planı
// `?transport=plan` ile açılır: gidiş servisi (2 koltuk, 2 durak), dönüş yol
// parası. Öbür senaryolar plansız ilanı varsayıyor (GET 404).
const shuttleId = "cccccccc-cccc-4ccc-8ccc-000000000001";
const stopIds = ["cccccccc-cccc-4ccc-8ccc-000000000011", "cccccccc-cccc-4ccc-8ccc-000000000012"];
// Backend `rate-limit.identity-reveal.max-attempts` üretimde saatte 30; sahte
// üçte kesiyor ki 429 yolu tek senaryoda görülsün.
const identityRevealHourlyLimit = 3;
// Şirket adresi düzenleme (is-koala/koala-web#172). Üyelik yalnız
// `?companyRole=` ile sıfırlanan durumda verilir: öbür senaryolar şirketsiz
// kullanıcıyı varsayıyor ve `/isveren/sirket` onlarda "şirket yok" ekranı.
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const referenceCountryId = "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52";
const referenceCityId = "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50";
const referenceDistricts = [
  { id: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51", name: "Beşiktaş" },
  { id: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53", name: "Kadıköy" },
];
// Oturum ayrıntısı (is-koala/koala-web#188). Yalnız `?sessions=` ile sıfırlanan
// durumda liste dolu gelir: öbür senaryolar boş listeyi varsayıyor.
// `sessions=detail` 0.9.28 sunucusunu, `sessions=legacy` ayrıntı ucunu
// bilmeyen eski sunucuyu (yol yalnız DELETE, GET'e 405) taklit eder.
const currentSessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";
const otherSessionId = "0e30edb1-3642-458b-aa0b-7569842448f0";
const currentDeviceUuid = "30c46a8e-3e1b-4c35-b616-550171243a8b";
const otherDeviceUuid = "5a7c1a3e-9d0e-4c8b-8f1a-2b3c4d5e6f70";
const sessionPathPattern = /^\/users\/me\/sessions\/([0-9a-f-]{36})$/;
const devicePathPattern = /^\/users\/me\/devices\/([0-9a-f-]{36})$/;
const fixtureManifestCreatedAt = new Date().toISOString();
const fixtureManifestExpiresAt = new Date(Date.now() + 3_600_000).toISOString();
const stateKeyPattern = /^[0-9a-f]{16}$/;
const states = new Map();
// Tek tıklık abonelikten çıkma (is-koala/koala-web#54, backend #234). Uç
// oturumsuz olduğu için durum test anahtarına değil tokenın kendisine bağlı:
// `abone-` ilk tıkta kapatır, sonrakilerde `alreadyDisabled=true` döner;
// `suresi-dolmus-` 400 EXPIRED, `ariza-` 503; öbür her token 400 INVALID.
const unsubscribeRequests = new Map();

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
      reviews: [],
      identityReveals: [],
      // `?workerIdentity=unverified`: fikstür işçisi kimliğini doğrulamamış
      // sayılır ve okuma 409 `WORKER_IDENTITY_NOT_VERIFIED` döner.
      workerIdentityVerified: url.searchParams.get("workerIdentity") !== "unverified",
      companyRole: url.searchParams.get("companyRole"),
      companyAddress: initialCompanyAddress(),
      companyRequests: [],
      sessionsMode: url.searchParams.get("sessions"),
      sessions: initialSessions(),
      deviceRenames: [],
      // `?transport=race`: aynı plan ama koltuk seçimi 409 `TRANSPORT_SHUTTLE_FULL`
      // ile reddedilir — görünümde boş görünen koltuk bu arada başkasınca alındı.
      // `?transport=seated`: gidiş servisinde başkalarınca seçilmiş 2 koltuk
      // (fikstürde koltuk seçebilen tek atama var; işverenin silme uyarısı ve
      // kapasite kuralı iki koltuk ister).
      transportPlan: ["plan", "race", "seated"].includes(url.searchParams.get("transport"))
        ? initialTransportPlan(url.searchParams.get("transport") === "seated" ? 2 : 0)
        : null,
      transportSeatRace: url.searchParams.get("transport") === "race",
      seats: [],
      transportRequests: [],
      // Bildirim tercihleri (is-koala/koala-web#198): backend'in döndürdüğü
      // gibi mesaj/ulaşım kategorileri ve SMS kanalı dahil; bir satır da
      // web'in henüz tanımadığı gelecekteki bir kategori.
      notificationPreferences: initialNotificationPreferences(),
      notificationPreferenceRequests: [],
    });
    return json(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/__test__/notification-preference-requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.notificationPreferenceRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/device-renames") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.deviceRenames)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/transport-requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.transportRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.accountDeletionRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/reviews") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.reviews)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/identity-reveals") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.identityReveals)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/company-requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.companyRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }
  if (request.method === "GET" && url.pathname === "/__test__/unsubscribe-requests") {
    return json(response, 200, { count: unsubscribeRequests.get(url.searchParams.get("token")) ?? 0 });
  }
  if (request.method === "GET" && url.pathname === "/__test__/application-requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.applicationRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
  }

  // Herkese açık formun aile metni yolu (is-koala/koala-web#184): bu adres
  // küçük katalogda olmayan bir kodla reddedilir ve metin tembel yüklenen aile
  // haritasından gelir. Öbür giriş denemeleri eskisi gibi aşağıda 401 alır.
  if (request.method === "POST" && url.pathname === "/auth/login") {
    const body = await readJson(request);
    if (body?.email === "aile-kodu@example.test") {
      return backendError(response, 400, "VALIDATION_FAILED", "VALIDATION");
    }
  }

  if (request.method === "GET" && url.pathname === `/jobs/${expiredOpenJobId}`) {
    return backendSuccess(response, expiredOpenJob());
  }
  if (request.method === "GET" && url.pathname === `/jobs/${openJobId}`) {
    // Herkese açık okuyucunun test anahtarı yok: özet oturumsuz istekte
    // fikstür planından, oturumlu istekte anahtarın planından kurulur.
    const viewerState = authorizedState(request);
    const transport = viewerState
      ? publicTransportSummary(viewerState)
      : publicTransportSummary({ transportPlan: initialTransportPlan() });
    return backendSuccess(response, { ...viewerJob(openJob(), request), transport });
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
    if (url.searchParams.get("query") === "__assert_distance_sort__") {
      const sortedByDistance = url.searchParams.get("sort") === "distance,asc";
      const hasWindow = Boolean(url.searchParams.get("startFrom"));
      if (!sortedByDistance || !hasWindow) {
        return backendError(response, 400, "PAGE_SORT_FIELD_NOT_ALLOWED", "VALIDATION");
      }
    }
    const summary = openJobSummary();
    if (url.searchParams.has("lat") && url.searchParams.has("lng")) {
      summary.distanceKm = 3.4;
    }
    return backendSuccess(response, {
      content: [viewerJob(summary, request)],
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

  if (request.method === "POST" && url.pathname === "/notification-preferences/unsubscribe") {
    const token = (await readJson(request))?.token;
    if (typeof token !== "string" || !token.trim()) {
      return backendError(response, 400, "VALIDATION_FAILED", "VALIDATION");
    }
    const previous = unsubscribeRequests.get(token) ?? 0;
    unsubscribeRequests.set(token, previous + 1);
    if (token.startsWith("abone-")) {
      return backendSuccess(response, {
        category: "MARKETINGS",
        channel: "EMAIL",
        alreadyDisabled: previous > 0,
      });
    }
    if (token.startsWith("suresi-dolmus-")) {
      return backendError(response, 400, "NOTIFICATION_UNSUBSCRIBE_TOKEN_EXPIRED", "VALIDATION");
    }
    if (token.startsWith("ariza-")) {
      return backendError(response, 503, "UNEXPECTED", "UNEXPECTED");
    }
    return backendError(response, 400, "NOTIFICATION_UNSUBSCRIBE_TOKEN_INVALID", "VALIDATION");
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
      companies: state.companyRole
        ? [{ companyId, companyName: "Koala Temizlik", role: state.companyRole, approved: true }]
        : [],
    });
  }
  if (url.pathname === `/companies/${companyId}`) {
    // `GET` üyeliğe bakmıyor (backend'deki gibi); `PATCH` yalnız ADMIN'e açık
    // ve geçemeyene 404 `USER_NOT_ASSOCIATED_WITH_COMPANY` (backend 0.9.24,
    // is-koala/koala-backend#288).
    if (request.method === "GET") {
      return backendSuccess(response, companyOf(state));
    }
    if (request.method === "PATCH") {
      const body = await readJson(request);
      state.companyRequests.push({ method: request.method, path: url.pathname, body });
      if (state.companyRole !== "ADMIN") {
        return backendError(response, 404, "USER_NOT_ASSOCIATED_WITH_COMPANY", "RESOURCE_NOT_FOUND");
      }
      if (body?.address) {
        const written = body.address;
        const district =
          referenceDistricts.find((entry) => entry.id === written.districtId) ?? referenceDistricts[0];
        const components = written.components ?? {};
        state.companyAddress = {
          countryName: "Türkiye",
          cityName: "İstanbul",
          districtName: district.name,
          components,
          displayAddress: `${components.thoroughfare ?? ""} No: ${components.buildingNumber ?? ""}, ${
            components.neighborhood ?? ""
          }, ${district.name}/İstanbul`,
          needsReview: false,
          position: { ...written.position },
        };
      }
      return backendSuccess(response, companyOf(state));
    }
  }
  if (request.method === "GET" && url.pathname === "/reference/countries") {
    return backendSuccess(response, [{ id: referenceCountryId, name: "Türkiye", code: "TR" }]);
  }
  if (request.method === "GET" && url.pathname === `/reference/countries/${referenceCountryId}/cities`) {
    return backendSuccess(response, [{ id: referenceCityId, name: "İstanbul" }]);
  }
  if (request.method === "GET" && url.pathname === `/reference/cities/${referenceCityId}/districts`) {
    return backendSuccess(response, referenceDistricts);
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
    // İki ödeme çıkışı. İlki 0.9.25 öncesi biçim: iş adı yok, web onu atama
    // listesinden `jobAssignmentId` ile eşler (is-koala/koala-web#165), ayrıntı
    // alanları yok → ekran tire çizer. İkincisi 0.9.25 `PayoutDto`: maskeli
    // IBAN, sağlayıcı referansı, çıkış/mutabakat anları (is-koala/koala-web#179).
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
      {
        id: "7e1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f72",
        jobAssignmentId: completedAssignmentId,
        jobTitle: "Etkinlik görevlisi",
        companyName: "Koala Etkinlik",
        maskedIban: "TR18***2315",
        bankAccountId: "9f1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f73",
        providerReference: "IYZ-7F3A9C",
        amount: "1250.00",
        currency: "TRY",
        status: "COMPLETED",
        failureReason: null,
        releasedAt: "2026-09-04T09:00:00Z",
        settledAt: "2026-09-05T08:00:00Z",
        completedAt: "2026-09-05T08:00:00Z",
        createdAt: "2026-09-04T09:00:00Z",
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
  if (request.method === "GET" && url.pathname === "/users/me/received-applications") {
    const status = url.searchParams.get("status");
    const jobId = url.searchParams.get("jobId");
    const filterCompanyId = url.searchParams.get("companyId");
    const page = Number(url.searchParams.get("page") ?? "0");
    const size = Number(url.searchParams.get("size") ?? "20");
    const content = receivedApplications().filter((application) => {
      if (status !== null && application.status !== status) return false;
      if (jobId !== null && application.jobId !== jobId) return false;
      if (filterCompanyId !== null && application.companyId !== filterCompanyId) return false;
      return true;
    });
    const start = Number.isSafeInteger(page) && page > 0 ? page * size : 0;
    const slice = content.slice(start, start + size);
    return backendSuccess(response, {
      content: slice,
      page: Number.isSafeInteger(page) && page > 0 ? page : 0,
      size,
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : Math.ceil(content.length / size),
      first: start === 0,
      last: start + size >= content.length,
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
    return backendSuccess(response, state.notificationPreferences);
  }
  if (request.method === "PUT" && url.pathname === "/users/me/notification-preferences") {
    // `UpdateNotificationPreferencesDto` doğrulamasının aynısı: bilinmeyen
    // enum değeri gövde çözümlemesinde, işlemsel kategoriyi kapatmak ve
    // tercih edilemeyen kanal `@AssertTrue` ile 400.
    const body = await readJson(request);
    const entries = Array.isArray(body?.preferences) ? body.preferences : [];
    state.notificationPreferenceRequests.push(entries);
    const invalid = entries.length === 0 || entries.some((entry) =>
      !notificationCategoryKinds[entry?.category] ||
      !notificationChannels.includes(entry?.channel) ||
      typeof entry?.enabled !== "boolean" ||
      (notificationCategoryKinds[entry.category] === "TRANSACTIONAL" && entry.enabled === false));
    if (invalid) return backendError(response, 400, "VALIDATION_FAILED", "VALIDATION");
    for (const entry of entries) {
      const row = state.notificationPreferences.find(
        (candidate) => candidate.category === entry.category && candidate.channel === entry.channel,
      );
      if (row) row.enabled = entry.enabled;
    }
    return backendSuccess(response, state.notificationPreferences);
  }
  if (request.method === "GET" && url.pathname === "/users/me/sessions") {
    if (!state.sessionsMode) return backendSuccess(response, []);
    return backendSuccess(
      response,
      state.sessions.filter((session) => session.active).map(sessionSummaryOf),
    );
  }
  const sessionMatch = sessionPathPattern.exec(url.pathname);
  if (sessionMatch && request.method === "GET") {
    if (state.sessionsMode !== "detail") {
      // Eski sunucu: `/users/me/sessions/{id}` yalnız DELETE ile eşleşiyor.
      response.writeHead(405, { allow: "DELETE" });
      return response.end();
    }
    const session = state.sessions.find((candidate) => candidate.id === sessionMatch[1]);
    if (!session || !session.active) {
      return backendError(response, 404, "SESSION_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    return backendSuccess(response, sessionDetailOf(session));
  }
  if (sessionMatch && request.method === "DELETE") {
    const session = state.sessions.find((candidate) => candidate.id === sessionMatch[1]);
    if (!session || !session.active) {
      return backendError(response, 404, "SESSION_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    session.active = false;
    return json(response, 200, { success: true, httpStatus: "OK", message: "Oturum kapatildi." });
  }
  const deviceMatch = devicePathPattern.exec(url.pathname);
  if (deviceMatch && request.method === "PATCH") {
    const body = await readJson(request);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    // Action boş ve 60+ adı backend'e hiç göndermiyor; backend'in 400'ünü
    // ekranda görmek için `__backend_reject__` her koşulda reddedilir.
    if (!name || name.length > 60 || name === "__backend_reject__") {
      return json(response, 400, {
        success: false,
        httpStatus: 400,
        errorCode: "VALIDATION_FAILED",
        errorCategory: "VALIDATION",
        message: "Dogrulama hatasi.",
        details: [{ field: "name", message: name ? "Cihaz adı kabul edilmedi." : "Cihaz adı boş olamaz." }],
        timeStamp: "2026-09-09T12:00:00Z",
      });
    }
    const session = state.sessions.find((candidate) => candidate.deviceId === deviceMatch[1]);
    if (!session) return backendError(response, 404, "DEVICE_NOT_FOUND", "RESOURCE_NOT_FOUND");
    session.customName = name;
    state.deviceRenames.push({ deviceId: deviceMatch[1], name });
    return backendSuccess(response, {
      id: session.deviceId,
      type: session.deviceType,
      name,
      customName: name,
      firstSeenAt: session.createdAt,
      lastSeenAt: session.lastAccessedAt,
    });
  }
  if (request.method === "GET" && url.pathname === "/users/me/assignments") {
    // Aynı atamalar iki kabuğa da servis edilir: `asEmployer=true` işveren
    // ayrıntısını, `asEmployer=false` çalışan iş ayrıntısını besler. Mesaj
    // kapısı `messagingAvailable` ile satırdan okunur (is-koala/koala-web#157).
    // Backend 0.9.25 (is-koala/koala-web#179): işçi görünümünde `pricing` ve
    // `totalCharged` null, tek fiyat alanı sayısal `workerPayout`; `myReview`
    // bu test anahtarının yazdığı değerlendirme, `counterpartyReviewed` yalnız
    // varlık bilgisi.
    const asEmployer = url.searchParams.get("asEmployer") === "true";
    const content = Number(url.searchParams.get("page") ?? 0) === 0
      ? assignments().map((assignment) => viewerAssignment(assignment, asEmployer, state))
      : [];
    return backendSuccess(response, {
      content,
      page: Number(url.searchParams.get("page") ?? 0),
      size: Number(url.searchParams.get("size") ?? 20),
      totalElements: assignments().length,
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
      totalElements: assignments().length,
      totalPages: 1,
      first: true,
      last: true,
    });
  }
  /*
   * İşçiyi değerlendirme (is-koala/koala-web#173). Backend `ReviewManager`
   * gibi: yalnız tamamlanmış atama, yazar başına tek kayıt; ikincisi 409
   * `REVIEW_ALREADY_REVIEWED`. Kayıt test anahtarının durumunda birikir.
   */
  const reviewMatch = reviewPathPattern.exec(url.pathname);
  if (request.method === "POST" && reviewMatch) {
    const body = await readJson(request);
    const assignmentId = reviewMatch[1];
    if (!assignments().some((assignment) => assignment.id === assignmentId)) {
      return backendError(response, 404, "REVIEW_ASSIGNMENT_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    if (assignmentId !== completedAssignmentId) {
      return backendError(response, 409, "REVIEW_WORK_NOT_COMPLETED", "CONFLICT");
    }
    if (!Number.isInteger(body?.rating) || body.rating < 1 || body.rating > 5) {
      return backendError(response, 400, "REVIEW_RATING_RANGE", "VALIDATION");
    }
    if (state.reviews.some((review) => review.assignmentId === assignmentId)) {
      return backendError(response, 409, "REVIEW_ALREADY_REVIEWED", "CONFLICT");
    }
    const review = {
      id: `dddddddd-dddd-4ddd-8ddd-${String(state.reviews.length + 1).padStart(12, "0")}`,
      author: { id: userId, firstName: "Ali", lastName: "Yılmaz" },
      rating: body.rating,
      comment: body.comment ?? null,
      anonymous: body.anonymous === true,
      createdAt: "2026-09-14T10:00:00Z",
    };
    state.reviews.push({ ...review, assignmentId });
    return json(response, 201, {
      success: true,
      httpStatus: "CREATED",
      timeStamp: "2026-09-09T12:00:00Z",
      data: review,
    });
  }
  /*
   * İşçi kimliği (is-koala/koala-web#185, backend 0.9.27). Backend
   * `IdentityRevealManager` gibi: yalnız işe alınmış atama (başkası 404 —
   * var/yok sızdırmıyor), doğrulanmamış işçide 409, saatlik sınırda 429; her
   * başarılı okuma kayda geçer.
   */
  const workerIdentityMatch = workerIdentityPathPattern.exec(url.pathname);
  if (request.method === "GET" && workerIdentityMatch) {
    const assignment = assignments().find((row) => row.id === workerIdentityMatch[1]);
    if (!assignment || !["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(assignment.status)) {
      return backendError(response, 404, "JOB_ASSIGNMENT_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    if (!state.workerIdentityVerified) {
      return backendError(response, 409, "WORKER_IDENTITY_NOT_VERIFIED", "DATA_CONFLICT");
    }
    if (state.identityReveals.length >= identityRevealHourlyLimit) {
      return backendError(response, 429, "IDENTITY_REVEAL_TOO_MANY_REQUESTS", "RATE_LIMITED");
    }
    state.identityReveals.push({ assignmentId: assignment.id, workerId: assignment.worker.id });
    return backendSuccess(response, {
      fullName: "Ayşe Yılmaz",
      tcIdentityNumber: "10000000146",
      birthDate: "1990-05-17",
      verifiedAt: "2026-09-01T10:15:30Z",
      verificationMethod: "DOCUMENT",
    });
  }
  /*
   * Ulaşım planı (is-koala/koala-web#187). Backend `TransportManager` gibi:
   * plan yoksa GET 404; PUT planı bütünüyle yazar, `id` taşıyan servis/durak
   * yerinde kalır, kalanlar yeni kimlik alır; koltuk seçimi yön başına tek,
   * dolu serviste 409 `TRANSPORT_SHUTTLE_FULL`; işçi görünümünde plaka/şoför
   * yalnız koltuk seçilen serviste.
   */
  if (url.pathname === `/jobs/${openJobId}/transport-plan`) {
    if (request.method === "GET") {
      return state.transportPlan
        ? backendSuccess(response, employerPlanView(state))
        : backendError(response, 404, "TRANSPORT_PLAN_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    if (request.method === "PUT") {
      const body = await readJson(request);
      state.transportRequests.push({ method: "PUT", path: url.pathname, body });
      if (!body || !["SHUTTLE", "CASH_ALLOWANCE", "SELF", "NONE"].includes(body.outboundMethod)) {
        return backendError(response, 400, "VALIDATION_FAILED", "VALIDATION");
      }
      const previous = state.transportPlan;
      let shuttles;
      try {
        shuttles = (body.shuttles ?? []).map((shuttle, index) => {
        const existing = previous?.shuttles.find((row) => row.id === shuttle.id) ?? null;
        if (existing && existing.direction !== shuttle.direction) {
          throw new ConflictSignal("TRANSPORT_SHUTTLE_DIRECTION_LOCKED");
        }
        const seatsTaken = existing ? existing.seatsTaken : 0;
        if (shuttle.capacity < seatsTaken) throw new ConflictSignal("TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS");
        return {
          id: existing?.id ?? `cccccccc-cccc-4ccc-8ccc-${String(100 + index).padStart(12, "0")}`,
          direction: shuttle.direction,
          name: shuttle.name,
          plate: shuttle.plate ?? null,
          capacity: shuttle.capacity,
          seatsTaken,
          driverName: shuttle.driverName ?? null,
          driverPhone: shuttle.driverPhone ?? null,
          sortOrder: index,
          stops: (shuttle.stops ?? []).map((stop, stopIndex) => {
            const existingStop = existing?.stops.find((row) => row.id === stop.id) ?? null;
            return {
              id: existingStop?.id ?? `cccccccc-cccc-4ccc-8ccc-${String(200 + index * 10 + stopIndex).padStart(12, "0")}`,
              label: stop.label ?? null,
              scheduledAt: stop.scheduledAt,
              sortOrder: stopIndex,
              address: stop.address ? addressFromWrite(stop.address) : existingStop?.address ?? null,
              seatsTaken: existingStop?.seatsTaken ?? 0,
            };
          }),
        };
        });
      } catch (error) {
        if (error instanceof ConflictSignal) return backendError(response, 409, error.code, "DATA_CONFLICT");
        throw error;
      }
      state.transportPlan = {
        outboundMethod: body.outboundMethod,
        returnMethod: body.returnMethod,
        allowanceAmount: body.allowanceAmount ?? null,
        allowanceNote: body.allowanceNote ?? null,
        notes: body.notes ?? null,
        shuttles,
        updatedAt: "2026-09-15T09:00:00Z",
      };
      return backendSuccess(response, employerPlanView(state));
    }
  }
  const transportMatch = assignmentTransportPathPattern.exec(url.pathname);
  if (transportMatch) {
    const assignment = assignments().find((row) => row.id === transportMatch[1]);
    if (!assignment || !state.transportPlan) {
      return backendError(response, 404, "TRANSPORT_PLAN_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }
    if (request.method === "GET" && !transportMatch[2]) {
      return backendSuccess(response, workerTransportView(state, assignment.id));
    }
    if (request.method === "PUT" && transportMatch[2]) {
      const body = await readJson(request);
      state.transportRequests.push({ method: "PUT", path: url.pathname, body });
      // `TransportManager.SEAT_STATUSES`: onay bekleyen atama koltuk seçemez.
      if (!["CONFIRMED", "IN_PROGRESS"].includes(assignment.status)) {
        return backendError(response, 409, "TRANSPORT_ASSIGNMENT_NOT_ACTIVE", "DATA_CONFLICT");
      }
      const shuttle = state.transportPlan.shuttles.find((row) => row.id === body?.shuttleId);
      const stop = shuttle?.stops.find((row) => row.id === body?.stopId);
      if (!shuttle || !stop) {
        return backendError(response, 404, "TRANSPORT_SHUTTLE_NOT_FOUND", "RESOURCE_NOT_FOUND");
      }
      const current = state.seats.find(
        (seat) => seat.assignmentId === assignment.id && seat.direction === shuttle.direction,
      );
      const taken = state.seats.filter((seat) => seat.shuttleId === shuttle.id).length;
      if (current?.shuttleId !== shuttle.id && (state.transportSeatRace || taken >= shuttle.capacity)) {
        return backendError(response, 409, "TRANSPORT_SHUTTLE_FULL", "DATA_CONFLICT");
      }
      if (current) {
        current.shuttleId = shuttle.id;
        current.stopId = stop.id;
      } else {
        state.seats.push({
          id: `dddddddd-dddd-4ddd-8ddd-${String(state.seats.length + 1).padStart(12, "0")}`,
          assignmentId: assignment.id,
          direction: shuttle.direction,
          shuttleId: shuttle.id,
          stopId: stop.id,
        });
      }
      return backendSuccess(response, workerTransportView(state, assignment.id));
    }
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

// Backend `NotificationCategory` / `NotificationChannel` (canlı OpenAPI).
const notificationCategoryKinds = {
  ACCOUNT_SECURITY: "TRANSACTIONAL",
  APPLICATION_UPDATES: "TRANSACTIONAL",
  IDENTITY_VERIFICATION: "TRANSACTIONAL",
  MARKETINGS: "COMMERCIAL",
  COMPANY_UPDATES: "TRANSACTIONAL",
  JOB_ALERTS: "ALERT",
  MESSAGES: "ALERT",
  NEWSLETTER: "COMMERCIAL",
  TRANSPORT: "TRANSACTIONAL",
};
const notificationChannels = ["EMAIL", "SMS", "PUSH", "IN_APP"];

function initialNotificationPreferences() {
  const row = (category, channel, enabled) => ({
    category,
    kind: notificationCategoryKinds[category] ?? "ALERT",
    channel,
    enabled,
    editable: (notificationCategoryKinds[category] ?? "ALERT") !== "TRANSACTIONAL",
  });
  return [
    row("ACCOUNT_SECURITY", "EMAIL", true),
    row("JOB_ALERTS", "PUSH", true),
    row("JOB_ALERTS", "SMS", false),
    row("MESSAGES", "EMAIL", true),
    row("MESSAGES", "SMS", true),
    row("NEWSLETTER", "EMAIL", true),
    row("TRANSPORT", "PUSH", true),
    // Web'in tanımadığı değer: formda gösterilmemeli, kaydı bozmamalı.
    { category: "FUTURE_CATEGORY", kind: "ALERT", channel: "EMAIL", enabled: true, editable: true },
  ];
}

function initialSessions() {
  return [
    {
      id: currentSessionId,
      deviceId: currentDeviceUuid,
      deviceType: "WEB_BROWSER",
      name: "iOS 18 · Koala 0.1.0 · web",
      customName: null,
      ipAddress: "192.0.2.1",
      location: "İstanbul, TR",
      createdAt: "2026-09-01T12:00:00Z",
      lastAccessedAt: "2026-09-06T12:00:00Z",
      refreshExpiresAt: "2026-10-06T12:00:00Z",
      current: true,
      active: true,
      logins: 3,
      loginHistory: [
        { at: "2026-09-06T12:00:00Z", ipAddress: "192.0.2.1", location: "İstanbul, TR", success: true },
        { at: "2026-09-05T20:00:00Z", ipAddress: "198.51.100.7", location: null, success: false },
      ],
    },
    {
      id: otherSessionId,
      deviceId: otherDeviceUuid,
      deviceType: "IOS",
      name: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0",
      customName: null,
      ipAddress: null,
      location: null,
      createdAt: "2026-08-20T12:00:00Z",
      lastAccessedAt: "2026-09-05T12:00:00Z",
      refreshExpiresAt: "2026-10-05T12:00:00Z",
      current: false,
      active: true,
      logins: 0,
      loginHistory: [],
    },
  ];
}

function sessionSummaryOf(session) {
  return {
    id: session.id,
    deviceId: session.deviceId,
    deviceType: session.deviceType,
    deviceName: session.customName ?? session.name,
    ipAddress: session.ipAddress,
    location: session.location,
    lastAccessedAt: session.lastAccessedAt,
    refreshExpiresAt: session.refreshExpiresAt,
    current: session.current,
  };
}

function sessionDetailOf(session) {
  return {
    ...sessionSummaryOf(session),
    deviceCustomName: session.customName,
    createdAt: session.createdAt,
    logins: session.logins,
    loginHistory: session.loginHistory,
  };
}

class ConflictSignal extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function initialTransportPlan(seatsTaken = 0) {
  return {
    outboundMethod: "SHUTTLE",
    returnMethod: "CASH_ALLOWANCE",
    allowanceAmount: 150,
    allowanceNote: "İş bitince elden",
    notes: "Servis 5 dk bekler.",
    updatedAt: "2026-09-14T08:00:00Z",
    shuttles: [
      {
        id: shuttleId,
        direction: "OUTBOUND",
        name: "Anadolu yakası servisi",
        plate: "34 ABC 12",
        capacity: 2,
        seatsTaken,
        driverName: "Mehmet Şoför",
        driverPhone: "0500 000 00 00",
        sortOrder: 0,
        stops: [
          {
            id: stopIds[0],
            label: "Kadıköy İskele",
            scheduledAt: "2026-09-20T03:40:00Z",
            sortOrder: 0,
            seatsTaken,
            address: stopAddress("Rıhtım Caddesi No: 1, Caferağa, Kadıköy/İstanbul", "Caferağa", 40.9925, 29.0245),
          },
          {
            id: stopIds[1],
            label: "Bostancı",
            scheduledAt: "2026-09-20T04:00:00Z",
            sortOrder: 1,
            seatsTaken: 0,
            address: stopAddress("Bağdat Caddesi No: 500, Suadiye, Kadıköy/İstanbul", "Suadiye", 40.9612, 29.0866),
          },
        ],
      },
    ],
  };
}

function stopAddress(displayAddress, neighborhood, latitude, longitude) {
  return {
    countryName: "Türkiye",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    components: { neighborhood },
    displayAddress,
    needsReview: false,
    position: { latitude, longitude, source: "USER_CONFIRMED_PIN" },
  };
}

function addressFromWrite(write) {
  const district = referenceDistricts.find((row) => row.id === write.districtId);
  const parts = [write.components?.thoroughfare, write.components?.buildingNumber ? `No: ${write.components.buildingNumber}` : null]
    .filter(Boolean)
    .join(" ");
  return {
    countryName: "Türkiye",
    cityName: "İstanbul",
    districtName: district?.name ?? "Kadıköy",
    components: write.components ?? {},
    displayAddress: `${parts}, ${write.components?.neighborhood ?? ""}, ${district?.name ?? "Kadıköy"}/İstanbul`,
    needsReview: false,
    position: { latitude: write.position?.latitude ?? 41, longitude: write.position?.longitude ?? 29, source: "USER_CONFIRMED_PIN" },
  };
}

/** İşveren görünümü: plaka/şoför/adres hepsinde, doluluk koltuk listesinden. */
function employerPlanView(state) {
  const plan = state.transportPlan;
  return {
    id: "eeeeeeee-eeee-4eee-8eee-000000000001",
    jobId: openJobId,
    ...plan,
    shuttles: plan.shuttles.map((shuttle) => ({
      ...shuttle,
      seatsTaken: shuttle.seatsTaken + state.seats.filter((seat) => seat.shuttleId === shuttle.id).length,
      stops: shuttle.stops.map((stop) => ({
        ...stop,
        seatsTaken: stop.seatsTaken + state.seats.filter((seat) => seat.stopId === stop.id).length,
      })),
    })),
  };
}

/** İşçi görünümü: plaka/şoför yalnız koltuk seçilen serviste, koltuklar bu atamanın. */
function workerTransportView(state, assignmentId) {
  const plan = state.transportPlan;
  const seats = state.seats.filter((seat) => seat.assignmentId === assignmentId);
  return {
    outboundMethod: plan.outboundMethod,
    returnMethod: plan.returnMethod,
    allowanceAmount: plan.allowanceAmount,
    allowanceNote: plan.allowanceNote,
    notes: plan.notes,
    shuttles: plan.shuttles.map((shuttle) => {
      const mine = seats.some((seat) => seat.shuttleId === shuttle.id);
      return {
        ...shuttle,
        plate: mine ? shuttle.plate : null,
        driverName: mine ? shuttle.driverName : null,
        driverPhone: mine ? shuttle.driverPhone : null,
        seatsTaken: shuttle.seatsTaken + state.seats.filter((seat) => seat.shuttleId === shuttle.id).length,
      };
    }),
    seats: seats.map((seat) => ({ id: seat.id, direction: seat.direction, shuttleId: seat.shuttleId, stopId: seat.stopId })),
  };
}

/** `JobDetailDto.transport`: herkese açık özet — plaka, şoför, tam adres yok. */
function publicTransportSummary(state) {
  const plan = state?.transportPlan;
  if (!plan) return null;
  return {
    outboundMethod: plan.outboundMethod,
    returnMethod: plan.returnMethod,
    allowanceAmount: plan.allowanceAmount,
    shuttleCount: plan.shuttles.length,
    shuttles: plan.shuttles.map((shuttle) => ({
      direction: shuttle.direction,
      name: shuttle.name,
      stops: shuttle.stops.map((stop) => ({
        districtName: stop.address?.districtName ?? null,
        neighborhood: stop.address?.components?.neighborhood ?? null,
        scheduledAt: stop.scheduledAt,
      })),
    })),
  };
}

function initialCompanyAddress() {
  return {
    countryName: "Türkiye",
    cityName: "İstanbul",
    districtName: "Beşiktaş",
    components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", buildingNumber: "12", postalCode: "34330" },
    displayAddress: "Büyükdere Caddesi No: 12, Levent, Beşiktaş/İstanbul",
    needsReview: false,
    position: { latitude: 41.081235, longitude: 29.008765, source: "LEGACY_UNVERIFIED" },
  };
}

function companyOf(state) {
  return {
    id: companyId,
    name: "Koala Temizlik",
    email: "bilgi@koala.test",
    logoUrl: null,
    phoneNumber: "05001112233",
    website: null,
    description: null,
    taxNumber: "1234567890",
    type: "LIMITED",
    address: state.companyAddress,
    companyContacts: [],
    followerCount: 0,
    approved: true,
  };
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

function receivedApplications() {
  const job = openJob();
  return [
    {
      id: "cccccccc-cccc-4ccc-8ccc-000000000001",
      status: "APPLIED",
      applicationDateTime: "2026-09-06T10:00:00Z",
      answeredDateTime: null,
      notes: "Hafta sonu uygunum.",
      applicant: { id: assignmentWorkerId, firstName: "Ayşe", lastName: "Yılmaz" },
      jobId: job.id,
      postingTitle: job.title,
      jobStatus: job.status,
      companyId: job.company?.id ?? companyId,
      companyName: job.company?.name ?? "Koala Temizlik",
      assignmentId: null,
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-000000000002",
      status: "REJECTED",
      applicationDateTime: "2026-09-05T09:00:00Z",
      answeredDateTime: "2026-09-05T12:00:00Z",
      notes: null,
      applicant: { id: assignmentWorkerId, firstName: "Ayşe", lastName: "Yılmaz" },
      jobId: job.id,
      postingTitle: job.title,
      jobStatus: job.status,
      companyId: job.company?.id ?? companyId,
      companyName: job.company?.name ?? "Koala Temizlik",
      assignmentId: null,
    },
  ];
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
    // Tamamlanmış atama: işverenin değerlendirme formu yalnız burada açılır
    // (is-koala/koala-web#173).
    {
      ...base,
      id: completedAssignmentId,
      status: "COMPLETED",
      paymentStatus: "RELEASED_TO_WORKER",
      actualCompletionDateTime: "2026-09-03T18:05:00Z",
      workHours: 8,
      messagingAvailable: false,
      messagingAvailableReason: "CLOSED",
    },
  ];
}

/**
 * Atama satırının görüntüleyene göre biçimi (backend 0.9.25). Gerçek backend
 * kararı satırın işçisi kim diye verir (görüntüleyen `worker.id` ise
 * `pricing`/`totalCharged` null); bu sahtede tek kullanıcı (`userId`) iki
 * kabuğu da sürüyor ve fikstür işçisi (`assignmentWorkerId`) o değil, yani
 * "görüntüleyen işçi mi" sorusu istekten çıkarılamıyor. Backend'in kendi
 * görünüm anahtarı `asEmployer` kullanılıyor: `asEmployer=false` zaten
 * "görüntüleyenin işçi olduğu satırlar" demek. `workerPayout` her iki tarafta
 * da sayı. Değerlendirme: bu anahtarın yazdığı kayıt `myReview` olur;
 * `counterpartyReviewed` tamamlanmış atamada işçiye "işveren seni
 * değerlendirdi" der, işverene henüz demez.
 */
function viewerAssignment(assignment, asEmployer, state) {
  const mine = state.reviews.find((review) => review.assignmentId === assignment.id) ?? null;
  return {
    ...assignment,
    workerPayout: Number(assignment.workerPayout),
    totalCharged: asEmployer ? assignment.totalCharged : null,
    pricing: asEmployer ? assignment.pricing : null,
    myReview: mine
      ? { id: mine.id, rating: mine.rating, comment: mine.comment, createdAt: mine.createdAt }
      : null,
    counterpartyReviewed: !asEmployer && assignment.id === completedAssignmentId,
  };
}

/**
 * İlanın görüntüleyene göre biçimi (backend 0.9.27, is-koala/koala-backend#304).
 * Gerçek backend tam dökümü yalnız ilanın sahibine ve şirket yetkilisine
 * veriyor; herkese açık ve işçi görünümünde `serviceFeeRate`,
 * `serviceFeeAmount` ve `employerTotal` null, `workerPayout` ile `currency`
 * kalıyor. Bu sahtede tek kullanıcı hem sahip hem işçi olduğu için ayrım
 * oturumdan okunuyor: tanıtım sayfası ilanı oturumsuz `web-public-reader`
 * kimliğiyle çekiyor, işveren kabuğu erişim tokenıyla.
 */
function viewerJob(job, request) {
  if (authorizedState(request) !== null || job.pricing === null) return job;
  const { pricingVersion, currency, workerPayout } = job.pricing;
  return {
    ...job,
    pricing: {
      pricingVersion,
      currency,
      workerPayout,
      serviceFeeRate: null,
      serviceFeeAmount: null,
      employerTotal: null,
    },
  };
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
