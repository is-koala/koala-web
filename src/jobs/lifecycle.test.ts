import { describe, expect, it } from "vitest";

import { jobApplicationsClosedReason, jobLifecycleActions, jobStatusLabel } from "./lifecycle";

/**
 * Geçiş tablosunun tek kaynağı sunucu.
 *
 * `JobManager.closeJob` yalnız `OPEN` durumundan geçiyor (`:446-456`),
 * `JobManager.cancelJob` ise `CANCELLED` ve `COMPLETED` dışındaki her
 * durumdan (`:388-402`). Bu testler o iki satırın ekrandaki karşılığı: bir
 * gün backend kuralı değişirse burada kırmızıya döner.
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

  it("tamamlanmış ilanı iptal ettirmez", () => {
    const [, cancel] = jobLifecycleActions("COMPLETED");

    expect(cancel.available).toBe(false);
    expect(cancel.blockedReason).toBe("Tamamlanmış bir ilan iptal edilemez.");
  });

  it("işi süren ilanda kapatma kapalı, iptal açık kalır", () => {
    // Sunucunun iptal kuralı bir dışlama listesi: `IN_PROGRESS` o listede yok.
    const [close, cancel] = jobLifecycleActions("IN_PROGRESS");

    expect(close.available).toBe(false);
    expect(cancel.available).toBe(true);
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
  it("backend enum'undaki beş durumun beşini de adlandırır", () => {
    // `JobStatus` beş değer taşıyor; dördünü etiketleyip beşincisini ham
    // hâliyle ekrana basmak, kullanıcıya İngilizce bir sabit göstermekti.
    expect(jobStatusLabel("OPEN")).toBe("Yayında — başvurulara açık");
    expect(jobStatusLabel("CLOSED")).toBe("Kapatıldı — yeni başvuru alınmıyor");
    expect(jobStatusLabel("IN_PROGRESS")).toBe("İş sürüyor");
    expect(jobStatusLabel("CANCELLED")).toBe("İptal edildi");
    expect(jobStatusLabel("COMPLETED")).toBe("Tamamlandı");
  });

  it("bilinmeyen durumu ham hâliyle ekrana basmaz", () => {
    expect(jobStatusLabel("DRAFT")).toBe("Durumu okunamadı");
  });
});

describe("kapalı ilana başvuru", () => {
  it("yayındaki ilanda başvuruyu engellemez", () => {
    expect(jobApplicationsClosedReason("OPEN")).toBeNull();
  });

  it("kapatılmış ilanda başvuru yüzeyini nedeniyle kapatır", () => {
    // Kabul maddesi: kapatma sonrası ilan yeni başvuru almaz. Backend
    // `JobApplicationManager` ilanın durumuna hiç bakmıyor, yani bu kuralı
    // web kendi yüzeyinde tutmak zorunda.
    expect(jobApplicationsClosedReason("CLOSED")).toBe(
      "Bu ilan kapatıldı ve yeni başvuru almıyor.",
    );
  });

  it("iptal edilmiş ve tamamlanmış ilanda da başvuru almaz", () => {
    expect(jobApplicationsClosedReason("CANCELLED")).toBe(
      "Bu ilan iptal edildi ve yeni başvuru almıyor.",
    );
    expect(jobApplicationsClosedReason("COMPLETED")).toBe(
      "Bu ilan tamamlandı ve yeni başvuru almıyor.",
    );
  });

  it("durumu okunamayan ilanda başvuruyu sessizce kapatmaz", () => {
    // Alan yanıttan hiç gelmezse durum `UNKNOWN` olur. Bilinmeyeni "kapalı"
    // saymak, tek bir sözleşme değişikliğinde her ilanın başvuru formunu
    // sessizce kaldırırdı; kapatma kararı yalnız sunucunun **söylediği**
    // durumlardan çıkar.
    expect(jobApplicationsClosedReason("UNKNOWN")).toBeNull();
    expect(jobApplicationsClosedReason("DRAFT")).toBeNull();
  });
});
