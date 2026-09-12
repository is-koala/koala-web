// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createIdentityUploadBodyReader } from "./upload-capacity";

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
    const read = createIdentityUploadBodyReader(1);
    const first = read(pausedRequest(started, finishReading));
    await startedReading;

    await expect(read(unreadableRequest())).resolves.toEqual({ acquired: false });

    finish();
    await expect(first).resolves.toMatchObject({ acquired: true });
    await expect(read(invalidMultipartRequest())).resolves.toMatchObject({ acquired: true });
  });
});

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
