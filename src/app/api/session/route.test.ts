import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const readSession = vi.hoisted(() => vi.fn());
const viewerShell = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("@/server/session/viewer", () => ({ viewerShell }));
vi.mock("next/navigation", async () => ({
  unstable_rethrow: (await import("../../../../tests/support/navigation")).rethrowTestNavigationError,
}));

describe("başlığın oturum ucu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturum yokken profil okumadan kapalı der", async () => {
    readSession.mockResolvedValue({ accessToken: null, refreshToken: null });

    const response = await GET();

    expect(await response.json()).toEqual({ authenticated: false, shell: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(viewerShell).not.toHaveBeenCalled();
  });

  it("oturum açıkken kullanıcının kabuğunu söyler", async () => {
    readSession.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    viewerShell.mockResolvedValue("employer");

    expect(await (await GET()).json()).toEqual({ authenticated: true, shell: "employer" });
  });

  it("profil arızasında oturumu açık ama kabuğu bilinmez bildirir", async () => {
    readSession.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    viewerShell.mockRejectedValue(new Error("ağ koptu"));

    expect(await (await GET()).json()).toEqual({ authenticated: true, shell: null });
  });

  it("oturum bitmişse profil okuyucusunun yönlendirmesini yutmaz", async () => {
    const { redirectTo } = await import("../../../../tests/support/navigation");
    readSession.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    const interrupt = new Error(redirectTo("/giris"));
    viewerShell.mockRejectedValue(interrupt);

    await expect(GET()).rejects.toBe(interrupt);
  });
});
