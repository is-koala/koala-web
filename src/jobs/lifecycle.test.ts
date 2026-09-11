import { describe, expect, it } from "vitest";

import { jobApplicationsClosedReason, jobLifecycleActions, jobStatusLabel } from "./lifecycle";

/**
 * Geçiş tablosunun tek kaynağı sunucu.
 *
 * `JobManager.closeJob` yalnız `OPEN` durumundan geçiyor (`:446-456`),
 * `JobManager.cancelJob` ise yalnız `CANCELLED` dışındaki her durumdan.
 * Bu testler o iki satırın ekrandaki karşılığı: bir gün backend kuralı
 * değişirse burada kırmızıya döner.
 */
describe("ilan yaşam döngüsü eylemleri", () => {
  it("yayındaki ilanda hem kapatmayı hem iptali sunar", () => {
    const actions = jobLifecycleActions("OPEN");

    expect(actions.map((action) => [action.operation, action.available])).toEqual([
      ["close", true],
      ["cancel", true],
    ]);
    expect(actions.every((action) => action.blockedReason === null)).toBe(true);
  });

  it("kapalı ilanda kapatmayı nedeniyle kaldırır, iptali bırakır", () => {
    const [close, cancel] = jobLifecycleActions("CLOSED");

    expect(close.available).toBe(false);
    expect(close.blockedReason).toBe("Bu ilan zaten kapalı; yeniden kapatılamaz.");
    expect(cancel.available).toBe(true);
  });

  it("iptal edilmiş ilanda iki eylemi de kapatır", () => {
    const [close, cancel] = jobLifecycleActions("CANCELLED");

    expect(close.available).toBe(false);
    expect(cancel.available).toBe(false);
    expect(cancel.blockedReason).toBe("Bu ilan zaten iptal edildi.");
  });

  it("sözleşmede olmayan eski durumları tanımadığı durum sayar", () => {
    const [close, cancel] = jobLifecycleActions("IN_PROGRESS");

    expect(close.available).toBe(false);
    expect(cancel.available).toBe(false);
    expect(cancel.blockedReason).toBe("Bu ilanın durumu okunamadığı için işlem yapılamıyor.");
  });

  it("tanımadığı durumda hiçbir eylemi açmaz", () => {
    // Etiketleyemediği bir durumda geri dönüşü olmayan düğme çizmek, kullanıcıya
    // ne yaptığını okuyamadığı bir eylem sunmak olurdu.
    const actions = jobLifecycleActions("DRAFT");

    expect(actions).toHaveLength(2);
    expect(actions.every((action) => !action.available)).toBe(true);
    expect(actions[1].blockedReason).toBe("Bu ilanın durumu okunamadığı için işlem yapılamıyor.");
  });

  it("her eylem onaydan önce sonucunu yazılı taşır", () => {
    const [close, cancel] = jobLifecycleActions("OPEN");

    expect(close.label).toBe("İlanı kapat");
    expect(close.consequence).toContain("aramalarda görünmez");
    expect(cancel.label).toBe("İlanı iptal et");
    expect(cancel.consequence).toContain("geri alınamaz");
  });
});

describe("ilan durumu etiketleri", () => {
  it("backend enum'undaki üç durumu adlandırır", () => {
    expect(jobStatusLabel("OPEN")).toBe("Yayında — başvurulara açık");
    expect(jobStatusLabel("CLOSED")).toBe("Kapatıldı — yeni başvuru alınmıyor");
    expect(jobStatusLabel("CANCELLED")).toBe("İptal edildi");
    expect(jobStatusLabel("IN_PROGRESS")).toBe("Durumu okunamadı");
    expect(jobStatusLabel("COMPLETED")).toBe("Durumu okunamadı");
  });

  it("bilinmeyen durumu ham hâliyle ekrana basmaz", () => {
    expect(jobStatusLabel("DRAFT")).toBe("Durumu okunamadı");
  });
});

describe("kapalı ilana başvuru", () => {
  it("yayındaki ilanda başvuruyu engellemez", () => {
    expect(jobApplicationsClosedReason({ status: "OPEN", acceptingApplications: true })).toBeNull();
  });

  it("kapatılmış ilanda başvuru yüzeyini nedeniyle kapatır", () => {
    // Kabul maddesi: kapatma sonrası ilan yeni başvuru almaz. Backend
    // `JobApplicationManager` ilanın durumuna hiç bakmıyor, yani bu kuralı
    // web kendi yüzeyinde tutmak zorunda.
    expect(jobApplicationsClosedReason({ status: "CLOSED", acceptingApplications: false })).toBe(
      "Bu ilan kapatıldı ve yeni başvuru almıyor.",
    );
  });

  it("iptal edilmiş ilanda başvuru almaz", () => {
    expect(jobApplicationsClosedReason({ status: "CANCELLED", acceptingApplications: false })).toBe(
      "Bu ilan iptal edildi ve yeni başvuru almıyor.",
    );
  });

  it("durumu okunamayan ilanda başvuru kapısını güvenli tarafta tutar", () => {
    expect(jobApplicationsClosedReason({ status: "UNKNOWN", acceptingApplications: false })).toBe(
      "Bu ilan yeni başvuru almıyor.",
    );
  });

  it("backend başvuru kabul etse bile tanınmayan durumda formu açmaz", () => {
    expect(jobApplicationsClosedReason({ status: "UNKNOWN", acceptingApplications: true })).toBe(
      "Bu ilan yeni başvuru almıyor.",
    );
    expect(jobApplicationsClosedReason({ status: "DRAFT", acceptingApplications: true })).toBe(
      "Bu ilan yeni başvuru almıyor.",
    );
  });
});
