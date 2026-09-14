import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../tests/support/control-flow";

import Page from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getNotificationPreferences = vi.hoisted(() => vi.fn());
const getUniversities = vi.hoisted(() => vi.fn());
const getAvailability = vi.hoisted(() => vi.fn());
const profilePageView = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/profile/profile", () => ({ getNotificationPreferences, getUniversities }));
vi.mock("@/server/profile/availability", () => ({ getAvailability }));
vi.mock("@/components/profile-page", () => ({ ProfilePageView: profilePageView }));

/** Sayfanın görünüme verdiği prop'lar; bileşen taklit edildiği için ağaçtan okunur. */
async function viewProps(): Promise<Record<string, unknown>> {
  const tree = (await Page()) as { type: unknown; props: Record<string, unknown> };
  expect(tree.type).toBe(profilePageView);
  return tree.props;
}

describe("profil sayfası yükleyicisi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: { id: "11111111-1111-4111-8111-111111111111", firstName: "Ayşe" },
      failure: null,
    });
    getNotificationPreferences.mockResolvedValue([]);
    getUniversities.mockResolvedValue([]);
    getAvailability.mockResolvedValue({ slots: [], exceptions: [] });
  });

  it("oturum yenilemesinin yönlendirmesini profil verisi hatasına dönüştürmez", async () => {
    // `apiRequest` oturumun bittiğini anlayınca `redirect()` fırlatıyor; bu
    // sayfanın yakalayacağı bir backend hatası değil, girişe giden yol.
    const interrupt = sessionExpiryRedirect("/giris?next=%2Fpanel%2Fprofil");
    getNotificationPreferences.mockRejectedValue(interrupt);

    await expect(Page()).rejects.toBe(interrupt);
  });

  it("backend hatasını koddan seçilen ekran durumuna çevirir", async () => {
    getUniversities.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    expect(await viewProps()).toMatchObject({
      preferences: { status: "ready", data: [] },
      universities: { status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 },
    });
  });

  it("müsaitliği kabuğun okuduğu kullanıcı kimliğiyle ister ve hatasını ayrı taşır", async () => {
    getAvailability.mockRejectedValue(
      new ApiError({
        status: 404,
        errorCode: "USER_NOT_FOUND",
        errorCategory: "RESOURCE_NOT_FOUND",
        message: "ham mesaj",
      }),
    );

    expect(await viewProps()).toMatchObject({
      availability: { status: "error", errorCode: "USER_NOT_FOUND", httpStatus: 404 },
      universities: { status: "ready", data: [] },
    });
    expect(getAvailability).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("bilinmeyen hatayı nötr yedeğe düşürür", async () => {
    getUniversities.mockRejectedValue(new Error("ağ koptu"));

    expect(await viewProps()).toMatchObject({
      universities: { status: "error", errorCode: "UNEXPECTED", httpStatus: 500 },
    });
  });
});
