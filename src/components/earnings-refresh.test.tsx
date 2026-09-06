import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EarningsRefresh } from "./earnings-refresh";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("kazanç görünürlüğü yenilemesi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pencere odağına ve görünür sekmeye dönünce sunucu bileşenini yeniler", () => {
    render(<EarningsRefresh />);

    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent(document, new Event("visibilitychange"));

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("arka plana alınırken gereksiz istek yapmaz", () => {
    render(<EarningsRefresh />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    fireEvent(document, new Event("visibilitychange"));

    expect(refresh).not.toHaveBeenCalled();
  });
});
