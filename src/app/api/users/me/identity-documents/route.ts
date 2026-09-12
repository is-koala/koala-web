import type { FormState } from "@/lib/form-state";
import { failureState } from "@/server/form";
import { verifyIdentityUploadSession } from "@/server/identity/upload-auth";
import { submitIdentityDocuments } from "@/server/identity/documents";
import { readIdentityUploadRequest } from "@/server/identity/upload-request";
import { takeIdentityUploadQuota } from "@/server/identity/upload-rate-limit";
import { readSession } from "@/server/session/session";
import { unstable_rethrow } from "next/navigation";

export const dynamic = "force-dynamic";

/** Büyük gövde ancak same-origin vekili, oturum ve kota kapılarından sonra okunur. */
export async function POST(request: Request): Promise<Response> {
  const session = await readSession();
  if (!session.refreshToken) {
    return stateResponse({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    });
  }

  const sessionFailure = await verifyIdentityUploadSession();
  if (sessionFailure) return stateResponse(sessionFailure);

  const quota = takeIdentityUploadQuota(session.deviceId);
  if (!quota.allowed) {
    return stateResponse(
      { status: "error", errorCode: "TOO_MANY_REQUESTS", httpStatus: 429 },
      { "Retry-After": String(quota.retryAfterSeconds) },
    );
  }

  const upload = await readIdentityUploadRequest(request);
  if (!upload.ok) return stateResponse(upload.state);

  try {
    await submitIdentityDocuments(upload.identity, upload.photos);
    return stateResponse({ status: "done" });
  } catch (error) {
    unstable_rethrow(error);
    return stateResponse(failureState(error));
  }
}

function stateResponse(state: FormState, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json(state, {
    status: state.status === "error" ? state.httpStatus : 201,
    headers,
  });
}
