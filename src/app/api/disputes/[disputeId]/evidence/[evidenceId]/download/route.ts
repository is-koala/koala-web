import { unstable_rethrow } from "next/navigation";

import { isUuid } from "@/lib/identifiers";
import { ApiError } from "@/server/api/errors";
import { bffUpstreamTimeoutMs, evidenceStorageOrigins } from "@/server/env";
import { apiRequestResponse, readSession } from "@/server/session/session";

export const dynamic = "force-dynamic";

type DownloadContext = {
  params: Promise<{ disputeId: string; evidenceId: string }>;
};

export async function GET(request: Request, context: DownloadContext) {
  const { disputeId, evidenceId } = await context.params;
  if (!isUuid(disputeId) || !isUuid(evidenceId)) {
    return errorResponse("VALIDATION_FAILED", 400);
  }

  const session = await readSession();
  if (!session.accessToken && !session.refreshToken) return errorResponse("UNAUTHORIZED", 401);

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(bffUpstreamTimeoutMs()),
    ]);
    const upstream = await apiRequestResponse(
      `/disputes/${disputeId}/evidence/${evidenceId}/download`,
      { cache: "no-store", redirect: "manual", signal },
    );
    const download = upstream.status >= 300 && upstream.status < 400
      ? await fetchSignedDownload(upstream.headers.get("location"), signal)
      : upstream;
    const headers = downloadHeaders();
    headers.set("Content-Disposition", "attachment");
    for (const name of ["content-type", "content-length"]) {
      const value = download.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(download.body, { status: download.status, headers });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return errorResponse(error.errorCode, error.status);
    if (error instanceof SignedDownloadError) {
      return errorResponse("STORAGE_DOWNLOAD_FAILED", 502);
    }
    return errorResponse("UNEXPECTED", 502);
  }
}

async function fetchSignedDownload(
  location: string | null,
  signal: AbortSignal,
): Promise<Response> {
  if (!location || !isAllowedStorageUrl(location)) throw new SignedDownloadError();
  try {
    const response = await fetch(location, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal,
      headers: new Headers({ Accept: "application/pdf,image/png,image/jpeg,image/webp" }),
    });
    if (!response.ok) throw new SignedDownloadError();
    return response;
  } catch (error) {
    if (error instanceof SignedDownloadError) throw error;
    throw new SignedDownloadError();
  }
}

function isAllowedStorageUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      ((url.port === "" && /(^|\.)s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i.test(url.hostname)) ||
        evidenceStorageOrigins().has(url.origin));
  } catch {
    return false;
  }
}

class SignedDownloadError extends Error {}

function errorResponse(errorCode: string, httpStatus: number) {
  return Response.json(
    { errorCode, httpStatus },
    { status: httpStatus, headers: downloadHeaders() },
  );
}

function downloadHeaders(): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
}
