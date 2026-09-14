import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../tests/support/session-cookies";

import {
  deleteAvailabilityExceptionAction,
  saveAvailabilityAction,
  saveAvailabilityExceptionAction,
} from "./availability-actions";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});
vi.mock("next/headers", async () => {
  const support = await import("../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("müsaitlik Server Action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/panel/profil");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    revalidatePath.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("tekrar eden satır alanlarını SaveAvailabilityDto olarak toptan yazar", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.append("slotDay", "MONDAY");
    form.append("slotStart", "09:00");
    form.append("slotEnd", "13:00");
    form.append("slotDay", "FRIDAY");
    form.append("slotStart", "18:00");
    form.append("slotEnd", "23:00");

    await expect(saveAvailabilityAction(idleFormState, form)).resolves.toEqual({ status: "done" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/availability");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      slots: [
        { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "13:00" },
        { dayOfWeek: "FRIDAY", startTime: "18:00", endTime: "23:00" },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/panel/profil");
  });

  it("çakışan aralığı satır numarasıyla reddeder ve backend'e çıkmaz", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    for (const [day, start, end] of [["MONDAY", "09:00", "13:00"], ["MONDAY", "12:00", "15:00"]]) {
      form.append("slotDay", day);
      form.append("slotStart", start);
      form.append("slotEnd", end);
    }

    await expect(saveAvailabilityAction(idleFormState, form)).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: { slots: "2. satır aynı günün başka bir aralığıyla çakışıyor." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backend'in 409 çakışma cevabını koduyla forma taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          success: false,
          httpStatus: 409,
          errorCode: "AVAILABILITY_SLOT_OVERLAP",
          errorCategory: "CONFLICT",
          message: "ham mesaj",
        }),
      ),
    );
    const form = new FormData();
    form.append("slotDay", "MONDAY");
    form.append("slotStart", "09:00");
    form.append("slotEnd", "13:00");

    await expect(saveAvailabilityAction(idleFormState, form)).resolves.toMatchObject({
      status: "error",
      errorCode: "AVAILABILITY_SLOT_OVERLAP",
      httpStatus: 409,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("tarih istisnasını doğrulayıp SaveAvailabilityExceptionDto olarak yazar", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.set("date", "2026-10-29");
    form.set("available", "false");
    form.set("note", "  Bayram  ");

    await expect(saveAvailabilityExceptionAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/availability/exceptions");
    expect(JSON.parse(init.body as string)).toEqual({
      date: "2026-10-29",
      available: false,
      note: "Bayram",
    });
  });

  it("bozuk tarihi ve seçilmemiş müsaitliği alan hatasıyla reddeder", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.set("date", "29.10.2026");

    await expect(saveAvailabilityExceptionAction(idleFormState, form)).resolves.toMatchObject({
      status: "error",
      fieldErrors: {
        date: "Geçerli bir tarih seç.",
        available: "O gün müsait olup olmadığını seç.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("istisna silmede kayıt kimliğini doğrular", async () => {
    const fetchMock = successfulFetch();

    await expect(
      deleteAvailabilityExceptionAction("../me", idleFormState, new FormData()),
    ).resolves.toMatchObject({ status: "error", errorCode: "VALIDATION_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      deleteAvailabilityExceptionAction(
        "77777777-7777-4777-8777-777777777777",
        idleFormState,
        new FormData(),
      ),
    ).resolves.toEqual({ status: "done" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.test/users/me/availability/exceptions/77777777-7777-4777-8777-777777777777",
    );
    expect(init.method).toBe("DELETE");
  });
});

function successfulFetch() {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, envelope(null))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
