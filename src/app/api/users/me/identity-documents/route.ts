import type { FormState } from "@/lib/form-state";
import { isSameOriginRequest } from "@/lib/same-origin";
import { failureState } from "@/server/form";
import {
  identityUploadAuthenticationFailure,
  verifyIdentityUploadSession,
} from "@/server/identity/upload-auth";
import { runIdentityUploadOperation } from "@/server/identity/upload-capacity";
import { submitIdentityDocuments } from "@/server/identity/documents";
import { readSession } from "@/server/session/session";
import { unstable_rethrow } from "next/navigation";

export const dynamic = "force-dynamic";

/** Büyük gövde ancak same-origin vekili, oturum ve bellek kapasitesi kapılarından sonra okunur. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return stateResponse({ status: "error", errorCode: "ACCESS_DENIED", httpStatus: 403 });
  }

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

  const operation = await runIdentityUploadOperation(request, async (upload) => {
    if (!upload.ok) return stateResponse(upload.state);

    try {
      await submitIdentityDocuments(upload.identity, upload.photos);
      return stateResponse({ status: "done" });
    } catch (error) {
      const authenticationFailure = identityUploadAuthenticationFailure(error);
      if (authenticationFailure) return stateResponse(authenticationFailure);
      unstable_rethrow(error);
      return stateResponse(failureState(error));
    }
  });
  if (!operation.acquired) {
    return stateResponse(
      {
        status: "error",
        errorCode: "IDENTITY_UPLOAD_CAPACITY_UNAVAILABLE",
        httpStatus: 503,
      },
      { "Retry-After": "1" },
    );
  }
  return operation.value;
}

function stateResponse(state: FormState, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json(state, {
    status: state.status === "error" ? state.httpStatus : 201,
    headers,
  });
}
