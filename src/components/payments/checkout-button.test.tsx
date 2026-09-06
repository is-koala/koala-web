import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { CheckoutButton } from "./checkout-button";

it("ödeme başlatma hatasını backend mesajı olmadan errorCode üzerinden gösterir", async () => {
  const action = vi.fn(async () => ({
    status: "error" as const,
    errorCode: "PAYMENT_PROVIDER_UNAVAILABLE",
    httpStatus: 502,
  }));
  const user = userEvent.setup();
  render(<CheckoutButton action={action} />);

  await user.click(screen.getByRole("button", { name: "Iyzico ile güvenli öde" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ödeme sağlayıcısına ulaşılamadı",
  );
  expect(screen.queryByText(/internal|provider response/i)).toBeNull();
});
