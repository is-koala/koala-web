import { createServer } from "node:http";

const port = Number(process.env.SITEMAP_PLAYWRIGHT_API_PORT ?? "3630");
const initialVersion = "11111111-1111-4111-8111-111111111111";
const replacementVersion = "22222222-2222-4222-8222-222222222222";
const rateLimitedVersion = "42942942-9429-4429-8429-429429429429";
const expiredVersion = "88888888-8888-4888-8888-888888888888";
const unknownVersion = "99999999-9999-4999-8999-999999999999";
const shardSize = 50_000;
let nowMilliseconds = Date.now();

const manifests = new Map([
  [initialVersion, manifest(initialVersion, 49_999, 600_000)],
  [expiredVersion, manifest(expiredVersion, 1, -1)],
]);
let currentVersion = initialVersion;
let manifestFailure = false;
const requestCounts = { manifest: 0, shard: 0, publicJobs: 0 };

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (request.method === "POST" && url.pathname === "/__test/replace-manifest") {
    manifests.set(replacementVersion, manifest(replacementVersion, 50_001, 3_600_000));
    currentVersion = replacementVersion;
    return success(response, { currentVersion });
  }

  if (request.method === "POST" && url.pathname === "/__test/expire-initial") {
    nowMilliseconds = Date.parse(manifests.get(initialVersion).expiresAt) + 1;
    return success(response, { now: new Date(nowMilliseconds).toISOString() });
  }

  if (request.method === "POST" && url.pathname === "/__test/fail-manifest") {
    manifestFailure = true;
    return success(response, { manifestFailure });
  }

  if (request.method === "GET" && url.pathname === "/__test/requests") {
    return success(response, requestCounts);
  }

  if (request.method === "GET" && url.pathname === "/__test/constants") {
    return success(response, {
      initialVersion,
      replacementVersion,
      rateLimitedVersion,
      expiredVersion,
      unknownVersion,
    });
  }

  if (request.method === "GET" && url.pathname === "/users/me") {
    if (!isIdentityUploadClient(request)) {
      return error(response, 401, "AUTHENTICATION_REQUIRED", "AUTHENTICATION");
    }
    return success(response, {
      id: "2592914e-b7f0-4b5f-a5d4-5c632daf2d96",
      firstName: "E2E",
      lastName: "Kullanıcı",
      email: "e2e@example.test",
      phoneNumber: "+905551112233",
      emailVerified: true,
      phoneVerified: true,
      experiences: [],
      educations: [],
      companies: [],
      identityVerified: false,
    });
  }

  if (request.method === "POST" && url.pathname === "/users/me/identity-documents") {
    if (!isIdentityUploadClient(request)) {
      return error(response, 401, "AUTHENTICATION_REQUIRED", "AUTHENTICATION");
    }
    await drain(request);
    return success(response, null);
  }

  if (request.method === "GET" && url.pathname === "/sitemap/jobs/manifest") {
    requestCounts.manifest += 1;
    if (manifestFailure) {
      return error(response, 503, "SITEMAP_TEMPORARILY_UNAVAILABLE", "UNEXPECTED");
    }
    return success(response, manifests.get(currentVersion));
  }

  const shardMatch = /^\/sitemap\/jobs\/manifests\/([^/]+)\/shards\/([^/]+)$/.exec(
    url.pathname,
  );
  if (request.method === "GET" && shardMatch) {
    requestCounts.shard += 1;
    const [, version, shardText] = shardMatch;
    if (version === rateLimitedVersion) {
      return error(response, 429, "AUTH_TOO_MANY_REQUESTS", "RATE_LIMITED");
    }
    if (!uuidPattern.test(version) || !signedIntegerPattern.test(shardText)) {
      return error(response, 400, "PARAMETER_MISSING", "VALIDATION_FAILED");
    }
    const shard = Number(shardText);
    if (!Number.isInteger(shard) || shard < signedIntMinimum || shard > signedIntMaximum) {
      return error(response, 400, "PARAMETER_MISSING", "VALIDATION_FAILED");
    }
    const manifestValue = manifests.get(version);
    if (
      !manifestValue ||
      Date.parse(manifestValue.expiresAt) <= nowMilliseconds ||
      shard < 0 ||
      shard >= manifestValue.shards.length
    ) {
      return error(response, 404, "SITEMAP_MANIFEST_NOT_FOUND", "RESOURCE_NOT_FOUND");
    }

    const start = shard * manifestValue.shardSize;
    const length = manifestValue.shards[shard].entryCount;
    const entries = Array.from({ length }, (_, offset) => {
      const index = start + offset;
      return {
        id: jobId(index),
        updatedAt: index === 0 ? "2026-09-09T10:11:12.123456Z" : null,
      };
    });
    return success(response, { version, shard, entries });
  }

  if (request.method === "GET" && url.pathname.startsWith("/jobs")) {
    requestCounts.publicJobs += 1;
    return error(response, 503, "PUBLIC_JOBS_MUST_NOT_BACK_SITEMAP", "UNEXPECTED");
  }

  return error(response, 503, "PLAYWRIGHT_API_UNAVAILABLE", "UNEXPECTED");
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

function manifest(version, entryCount, ttlMilliseconds) {
  const count = Math.ceil(entryCount / shardSize);
  return {
    version,
    createdAt: new Date(nowMilliseconds - 60_000).toISOString(),
    expiresAt: new Date(nowMilliseconds + ttlMilliseconds).toISOString(),
    entryCount,
    shardSize,
    shards: Array.from({ length: count }, (_, number) => ({
      number,
      entryCount: Math.min(shardSize, entryCount - number * shardSize),
    })),
  };
}

function jobId(index) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function success(response, data) {
  json(response, 200, { success: true, data });
}

function error(response, status, errorCode, errorCategory) {
  json(response, status, { success: false, errorCode, errorCategory });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function isIdentityUploadClient(request) {
  return (
    request.headers["x-device-id"] === "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e"
    && request.headers.authorization === "Bearer access-1450145014501450"
  );
}

async function drain(request) {
  for await (const chunk of request) void chunk;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const signedIntegerPattern = /^(?:0|[1-9]\d*|-[1-9]\d*)$/;
const signedIntMinimum = -2_147_483_648;
const signedIntMaximum = 2_147_483_647;
