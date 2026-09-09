import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("uygulama hata sınırı", () => {
  it("yeniden denemede içeriği tekrar isteyen callback'i kullanır", async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<ErrorPage error={new Error("bozuk")} retry={retry} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Yeniden dene" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Yeniden dene" })).toHaveLength(1);
  });
});
