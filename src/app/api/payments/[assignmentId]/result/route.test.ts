import { expect, it, vi } from "vitest";

const readPaymentResultPoll = vi.hoisted(() => vi.fn());
vi.mock("@/server/payments/result-route", () => ({ readPaymentResultPoll }));

import { GET } from "./route";

it("poll sonucunu önbelleksiz GET yanıtı olarak taşır", async () => {
  readPaymentResultPoll.mockResolvedValue({ status: 200, body: { status: "pending" } });
  const response = await GET(new Request("https://iskoala.com/api/payments/a/result"), {
    params: Promise.resolve({ assignmentId: "a" }),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ status: "pending" });
});
