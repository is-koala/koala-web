import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  deleteAvailabilityException,
  getAvailability,
  saveAvailability,
  saveAvailabilityException,
} from "./availability";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const userId = "11111111-1111-4111-8111-111111111111";

describe("müsaitlik backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kendi müsaitliğini kullanıcı kimliğiyle okur ve saniyeli saatleri kırpar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          slots: [
            { id: "s1", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "13:00:00" },
            // Tanınmayan gün düşer; yanıtın kalanı çizilmeye devam eder.
            { id: "s2", dayOfWeek: "FUNDAY", startTime: "09:00", endTime: "13:00" },
          ],
          exceptions: [{ id: "e1", date: "2026-10-29", available: false, note: null }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAvailability(userId)).resolves.toEqual({
      slots: [{ id: "s1", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "13:00" }],
      exceptions: [{ id: "e1", date: "2026-10-29", available: false, note: null }],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/users/${userId}/availability`,
    );
  });

  it("gövdesiz yanıtı boş müsaitlik olarak okur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(getAvailability(userId)).resolves.toEqual({ slots: [], exceptions: [] });
  });

  it("haftalık aralıkları SaveAvailabilityDto olarak toptan yazar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await saveAvailability([{ dayOfWeek: "MONDAY", startTime: "09:00", endTime: "13:00" }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/availability");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(
      JSON.stringify({ slots: [{ dayOfWeek: "MONDAY", startTime: "09:00", endTime: "13:00" }] }),
    );
  });

  it("tarih istisnasını yazar ve kimliğiyle siler", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, envelope(null))));
    vi.stubGlobal("fetch", fetchMock);

    await saveAvailabilityException({ date: "2026-10-29", available: false, note: "Bayram" });
    await deleteAvailabilityException("e1");

    const [writeUrl, writeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(writeUrl).toBe("https://api.example.test/users/me/availability/exceptions");
    expect(writeInit.method).toBe("PUT");
    expect(writeInit.body).toBe(
      JSON.stringify({ date: "2026-10-29", available: false, note: "Bayram" }),
    );
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteUrl).toBe("https://api.example.test/users/me/availability/exceptions/e1");
    expect(deleteInit.method).toBe("DELETE");
  });
});
