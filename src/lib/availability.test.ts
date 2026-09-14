import { describe, expect, it } from "vitest";

import { parseSlots, sortSlots, toClockTime } from "./availability";

describe("haftalık müsaitlik sözleşmesi", () => {
  it("backend'in saniyeli LocalTime değerini form saatine kırpar", () => {
    expect(toClockTime("09:00:00")).toBe("09:00");
    expect(toClockTime("18:30")).toBe("18:30");
    // Tanınmayan biçim olduğu gibi kalır; ekranda ham görünür, gizlenmez.
    expect(toClockTime("sabah")).toBe("sabah");
  });

  it("satırları SlotWrite listesine çevirir ve saniyeyi düşürür", () => {
    expect(
      parseSlots(["MONDAY", "FRIDAY"], ["09:00:00", "18:00"], ["13:00:00", "23:00"]),
    ).toEqual({
      slots: [
        { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "13:00" },
        { dayOfWeek: "FRIDAY", startTime: "18:00", endTime: "23:00" },
      ],
    });
  });

  it("boş listeyi geçerli sayar: kullanıcı bütün aralıkları silmiş demek", () => {
    expect(parseSlots([], [], [])).toEqual({ slots: [] });
  });

  it("bitişi başlangıçtan önce olan satırı backend'e göndermeden reddeder", () => {
    // Backend de 400 döner; ama satır numarasını yalnız biz biliyoruz.
    expect(parseSlots(["MONDAY"], ["13:00"], ["09:00"])).toEqual({
      error: "1. satırda bitiş saati başlangıçtan sonra olmalı.",
    });
  });

  it("aynı günün çakışan aralığını satır numarasıyla reddeder", () => {
    // Backend aynı durumu 409 ile reddediyor; kullanıcı hangi satır olduğunu okumalı.
    expect(
      parseSlots(["MONDAY", "MONDAY"], ["09:00", "12:00"], ["13:00", "15:00"]),
    ).toEqual({ error: "2. satır aynı günün başka bir aralığıyla çakışıyor." });
    // Bitişik aralıklar çakışma değil.
    expect(parseSlots(["MONDAY", "MONDAY"], ["09:00", "13:00"], ["13:00", "15:00"]).error).toBeUndefined();
  });

  it("tanınmayan günü ve bozuk saati reddeder", () => {
    expect(parseSlots(["FUNDAY"], ["09:00"], ["10:00"])).toEqual({
      error: "1. satırda geçerli bir gün seç.",
    });
    expect(parseSlots(["MONDAY"], ["9"], ["10:00"])).toEqual({
      error: "1. satırda başlangıç ve bitiş saatini SS:DD biçiminde gir.",
    });
  });

  it("eksik gönderilen satırı sessizce tamamlamaz", () => {
    expect(parseSlots(["MONDAY", "TUESDAY"], ["09:00"], ["10:00", "11:00"]).error).toMatch(
      /eksik gönderildi/,
    );
  });

  it("haftanın sırasına, sonra saate göre dizer", () => {
    expect(
      sortSlots([
        { dayOfWeek: "SUNDAY", startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: "MONDAY", startTime: "14:00", endTime: "16:00" },
        { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "10:00" },
      ]).map((slot) => `${slot.dayOfWeek} ${slot.startTime}`),
    ).toEqual(["MONDAY 09:00", "MONDAY 14:00", "SUNDAY 09:00"]);
  });
});
