import { expect, it, vi } from "vitest";

const readPaymentResultPoll = vi.hoisted(() => vi.fn());
vi.mock("@/server/payments/result-route", () => ({ readPaymentResultPoll }));

import { GET } from "./route";

const expectedPrivateHeaders = [
  ["Cache-Control", "no-store"],
  ["X-Robots-Tag", "noindex, nofollow, noarchive"],
  ["Referrer-Policy", "strict-origin"],
  ["X-Content-Type-Options", "nosniff"],
] as const;

function expectPrivateHeaders(response: Response) {
  for (const [name, value] of expectedPrivateHeaders) {
    expect(response.headers.get(name), name).toBe(value);
  }
}

it("başarılı poll sonucunu private güvenlik başlıklarıyla taşır", async () => {
  readPaymentResultPoll.mockResolvedValue({ status: 200, body: { status: "pending" } });
  const response = await GET(new Request("https://iskoala.com/api/payments/a/result"), {
    params: Promise.resolve({ assignmentId: "a" }),
  });

  expect(response.status).toBe(200);
  expectPrivateHeaders(response);
  await expect(response.json()).resolves.toEqual({ status: "pending" });
});

it("hata poll sonucunda aynı private güvenlik başlıklarını korur", async () => {
  readPaymentResultPoll.mockResolvedValue({
    status: 401,
    body: { status: "error", errorCode: "AUTHENTICATION_REQUIRED", httpStatus: 401 },
  });
  const response = await GET(new Request("https://iskoala.com/api/payments/a/result"), {
    params: Promise.resolve({ assignmentId: "a" }),
  });

  expect(response.status).toBe(401);
  expectPrivateHeaders(response);
  await expect(response.json()).resolves.toEqual({
    status: "error",
    errorCode: "AUTHENTICATION_REQUIRED",
    httpStatus: 401,
  });
});
