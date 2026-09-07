import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pending = vi.hoisted(() => ({ value: false }));

vi.mock("next/link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/link")>()),
  useLinkStatus: () => ({ pending: pending.value }),
}));

const { LinkPending } = await import("./link-pending");

describe("bağlantı bekleme göstergesi", () => {
  beforeEach(() => {
    pending.value = false;
  });

  it("gezinme sürerken beklendiğini duyurur", () => {
    pending.value = true;

    render(<LinkPending />);

    expect(screen.getByText("Yükleniyor…")).toBeVisible();
  });

  it("bekleme yokken hiçbir şey çizmez", () => {
    const { container } = render(<LinkPending />);

    // Boşta duran kalıcı bir gösterge, sayfalama satırını her zaman
    // yükleniyormuş gibi gösterirdi.
    expect(container).toBeEmptyDOMElement();
  });
});
