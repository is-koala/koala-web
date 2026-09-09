"use client";

import { useState } from "react";

import { errorPresentation } from "@/lib/errors";
import { safeDownloadFileName } from "@/lib/file-names";

type DownloadFailure = {
  errorCode: string | null;
  httpStatus: number;
};

export function EvidenceDownloadButton({
  href,
  fileName,
}: {
  href: string;
  fileName: string;
}) {
  const safeFileName = safeDownloadFileName(fileName);
  const [isDownloading, setIsDownloading] = useState(false);
  const [failure, setFailure] = useState<DownloadFailure | null>(null);

  async function download() {
    setIsDownloading(true);
    setFailure(null);
    let objectUrl: string | null = null;
    let anchor: HTMLAnchorElement | null = null;

    try {
      const response = await fetch(href, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: { Accept: "application/octet-stream" },
      });

      if (!response.ok) {
        setFailure(await responseFailure(response));
        return;
      }

      objectUrl = URL.createObjectURL(await response.blob());
      anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeFileName;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
    } catch {
      setFailure({ errorCode: "STORAGE_DOWNLOAD_FAILED", httpStatus: 502 });
    } finally {
      anchor?.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsDownloading(false);
    }
  }

  const presentation = failure
    ? errorPresentation(failure.errorCode, failure.httpStatus)
    : null;

  return (
    <>
      <button
        type="button"
        className="button-link"
        aria-label={`${safeFileName} dosyasını indir`}
        disabled={isDownloading}
        onClick={() => void download()}
      >
        {isDownloading ? "İndiriliyor…" : safeFileName}
      </button>
      {presentation ? (
        <p role="alert" className="form-warning">
          {presentation.message}
        </p>
      ) : null}
    </>
  );
}

async function responseFailure(response: Response): Promise<DownloadFailure> {
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    return { errorCode: "AUTHENTICATION_REQUIRED", httpStatus: 401 };
  }

  const fallback = { errorCode: null, httpStatus: response.status || 502 };
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) return fallback;

  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return fallback;
    const { errorCode, httpStatus } = body as Record<string, unknown>;
    return {
      errorCode: typeof errorCode === "string" ? errorCode : null,
      httpStatus: typeof httpStatus === "number" ? httpStatus : fallback.httpStatus,
    };
  } catch {
    return fallback;
  }
}
