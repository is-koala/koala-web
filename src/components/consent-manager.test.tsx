import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { consentStorageKey } from "@/analytics/consent";
import { ConsentManager } from "./consent-manager";

describe("ConsentManager", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, "", "/hesap-dogrula?token=secret");
  });

  it("karar verilmeden ölçümleme isteği göndermez", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    render(<ConsentManager />);

    expect(await screen.findByRole("region", { name: "Çerez tercihleri" })).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("ret tercihini sürümlü saklar ve yeniden sormaz", async () => {
    const { unmount } = render(<ConsentManager />);

    fireEvent.click(await screen.findByRole("button", { name: "Yalnız zorunlu" }));
    expect(localStorage.getItem(consentStorageKey)).toContain('"analytics":false');
    unmount();

    render(<ConsentManager />);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Çerez tercihleri" })).not.toBeInTheDocument());
  });

  it("izin verilince tokensız görüntüleme ve masaüstü sonucu gönderir", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);

    render(<ConsentManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Ölçümlemeye izin ver" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const bodies = fetcher.mock.calls.map(
      ([, request]) => (request as RequestInit).body,
    );
    expect(bodies).toEqual([
      JSON.stringify({ event: "handoff_viewed", platform: "desktop" }),
      JSON.stringify({ event: "desktop_fallback", platform: "desktop" }),
    ]);
    expect(bodies.join()).not.toContain("secret");
  });
});
