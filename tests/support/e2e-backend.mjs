import { createServer } from "node:http";

const port = Number(process.argv[2]);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("E2E backend port must be a valid TCP port.");
}

const accountDeletionId = "bb58c5e0-e43b-4673-ae62-3525d4f7ec75";
const userId = "2592914e-b7f0-4b5f-a5d4-5c632daf2d96";
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
    states.set(key, { accountDeletion: null, accountDeletionRequests: [] });
    return json(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/__test__/requests") {
    const state = stateFrom(url);
    return state
      ? json(response, 200, state.accountDeletionRequests)
      : backendError(response, 404, "TEST_STATE_NOT_FOUND", "RESOURCE_NOT_FOUND");
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
  if (request.method === "GET" && url.pathname === "/users/me/bank-accounts") {
    return backendSuccess(response, []);
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

function backendSuccess(response, data) {
  return json(response, 200, {
    success: true,
    httpStatus: "OK",
    timeStamp: "2026-09-09T12:00:00Z",
    data,
  });
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
