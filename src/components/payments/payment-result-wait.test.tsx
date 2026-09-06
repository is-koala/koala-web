import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { PaymentResultWait } from "./payment-result-wait";

const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => vi.clearAllMocks());

it("bekleyen sonucu üst sınırlı ve backoff sıralı kontrollerden sonra bekleme ekranında bırakır", async () => {
  const check = vi.fn(async () => ({ status: "pending" as const }));

  render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      check={check}
      retryDelaysMs={[0, 0, 0]}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Ödeme sonucunu bekliyoruz");
  await waitFor(() => expect(check).toHaveBeenCalledTimes(3));
  expect(await screen.findByText(/kontrol süresi doldu/i)).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

it("backend sonucu kesinleşince atama ayrıntısına yalnız doğrulanmış dönüş işaretiyle gider", async () => {
  const check = vi.fn(async () => ({ status: "resolved" as const }));

  render(
    <PaymentResultWait
      assignmentId="3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e"
      check={check}
      retryDelaysMs={[0]}
    />,
  );

  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith(
      "/isveren/atama/3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e?paymentReturn=1",
    );
  });
});
