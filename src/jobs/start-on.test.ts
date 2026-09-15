import { afterEach, describe, expect, it, vi } from "vitest";

import { jobStartWindow, parseJobStartOn } from "./start-on";

describe("başlangıç günü süzgeci", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("geçersiz değeri düşürür", () => {
    expect(parseJobStartOn("garson")).toBeNull();
    expect(parseJobStartOn("2026-13-01")).toBeNull();
    expect(parseJobStartOn("2026-02-31")).toBeNull();
    expect(parseJobStartOn("32-01-01")).toBeNull();
  });

  it("üç örnek: belirli gün, bugün ve yarın İstanbul gün sınırına gider", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00+03:00"));
    const now = new Date();

    expect(jobStartWindow("2026-09-20", now)).toEqual({
      startFrom: "2026-09-19T21:00:00.000Z",
      startTo: "2026-09-20T20:59:59.999Z",
    });
    expect(jobStartWindow("bugun", now)).toEqual({
      startFrom: "2026-09-14T21:00:00.000Z",
      startTo: "2026-09-15T20:59:59.999Z",
    });
    expect(jobStartWindow("yarin", now)).toEqual({
      startFrom: "2026-09-15T21:00:00.000Z",
      startTo: "2026-09-16T20:59:59.999Z",
    });
  });

  it("bu hafta Pazartesi–Pazar, hafta sonu Cumartesi–Pazar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00+03:00"));
    const now = new Date();

    expect(jobStartWindow("bu-hafta", now)).toEqual({
      startFrom: "2026-09-13T21:00:00.000Z",
      startTo: "2026-09-20T20:59:59.999Z",
    });
    expect(jobStartWindow("hafta-sonu", now)).toEqual({
      startFrom: "2026-09-18T21:00:00.000Z",
      startTo: "2026-09-20T20:59:59.999Z",
    });
  });
});
