// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createIdentityUploadOperationRunner } from "./upload-capacity";

describe("kimlik yükleme gövdesi kapasitesi", () => {
  it("aynı anda yalnız yapılandırılan sayıda gövde okur ve bitince sıradakine yer açar", async () => {
    let started: () => void = () => undefined;
    let finish: () => void = () => undefined;
    const startedReading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const finishReading = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const run = createIdentityUploadOperationRunner(1);
    const first = run(pausedRequest(started, finishReading), async (upload) => upload);
    await startedReading;

    await expect(run(unreadableRequest(), async (upload) => upload)).resolves.toEqual({
      acquired: false,
    });

    finish();
    await expect(first).resolves.toMatchObject({ acquired: true });
    await expect(
      run(invalidMultipartRequest(), async (upload) => upload),
    ).resolves.toMatchObject({ acquired: true });
  });

  it("parçalar arasında bekleyen istemciyi zaman aşımına uğratıp kapasiteyi bırakır", async () => {
    let cancelled = false;
    const run = createIdentityUploadOperationRunner(1, 10);
    const timedOut = await run(slowRequest(() => {
      cancelled = true;
    }), async (upload) => upload);

    expect(timedOut).toMatchObject({
      acquired: true,
      value: {
        ok: false,
        state: {
          status: "error",
          errorCode: "IDENTITY_UPLOAD_TIMED_OUT",
          httpStatus: 408,
        },
      },
    });
    expect(cancelled).toBe(true);
    await expect(
      run(invalidMultipartRequest(), async (upload) => upload),
    ).resolves.toMatchObject({ acquired: true });
  });
});

function slowRequest(onCancel: () => void): Request {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      timer = setTimeout(() => {
        if (cancelled) return;
        controller.enqueue(new TextEncoder().encode("geçersiz multipart"));
        controller.close();
      }, 50);
    },
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
      onCancel();
    },
  });
  return new Request("https://iskoala.com/api/users/me/identity-documents", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function pausedRequest(onRead: () => void, release: Promise<void>): Request {
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (sent) return;
      sent = true;
      onRead();
      await release;
      controller.enqueue(new TextEncoder().encode("geçersiz multipart"));
      controller.close();
    },
  });
  return new Request("https://iskoala.com/api/users/me/identity-documents", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function unreadableRequest(): Request {
  return {
    headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
    get body(): never {
      throw new Error("Kapasite yokken gövde okunmamalı.");
    },
  } as unknown as Request;
}

function invalidMultipartRequest(): Request {
  return new Request("https://iskoala.com/api/users/me/identity-documents", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    body: "geçersiz multipart",
  });
}
