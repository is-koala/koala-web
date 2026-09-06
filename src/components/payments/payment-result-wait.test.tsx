import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { PaymentResultWait } from "./payment-result-wait";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const replace = router.replace;

vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("bekleyen sonucu üst sınırlı ve backoff sıralı kontrollerden sonra bekleme ekranında bırakır", async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ status: "pending" }));
  vi.stubGlobal("fetch", fetchMock);

  render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      initialTone="success"
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Ödeme dönüşü alındı");
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1_999));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(3_999));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.getByText(/kontrol süresi doldu/i)).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

it("backend sonucu kesinleşince atama ayrıntısına yalnız doğrulanmış dönüş işaretiyle gider", async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ status: "resolved" }));
  vi.stubGlobal("fetch", fetchMock);

  render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      initialTone="failed"
    />,
  );

  expect(screen.getByRole("heading")).toHaveTextContent("Ödeme tamamlanamadı bildirimi alındı");
  await act(async () => vi.advanceTimersByTimeAsync(1_000));
  expect(replace).toHaveBeenCalledWith(
    "/isveren/atama/3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e?paymentReturn=1",
  );
});

it("poll isteği giriş sayfasına yönlendirilirse HTML yanıtını parse etmeden oturum hatası gösterir", async () => {
  const json = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({ redirected: true, json } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);

  render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      initialTone="success"
    />,
  );

  await act(async () => vi.advanceTimersByTimeAsync(1_000));
  expect(screen.getByRole("heading")).toHaveTextContent("Oturum açman gerekiyor");
  expect(json).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(7_000));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
});

it("ekrandan ayrılınca bekleyen kontrol zamanlayıcısını iptal eder", async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ status: "pending" }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      initialTone="success"
    />,
  );

  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(7_000));
  expect(fetchMock).not.toHaveBeenCalled();
});

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
