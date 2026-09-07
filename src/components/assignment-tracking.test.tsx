import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TrackingEvent } from "@/assignments/employer-tracking";
import type { WorkSession } from "@/assignments/work-detail";

import { EmployerAssignmentTracking } from "./assignment-tracking";

const timeline: readonly TrackingEvent[] = [
  { key: "offered", label: "Teklif işçiye gönderildi", at: "2026-09-01T09:00:00Z", reached: true },
  { key: "confirmed", label: "İşçi atamayı onayladı", at: null, reached: true },
  { key: "started", label: "İş başladı", at: "2026-09-02T08:00:00Z", reached: true },
  { key: "completed", label: "İş tamamlandı olarak işaretlendi", at: null, reached: false },
];

const sessions: readonly WorkSession[] = [
  { id: "s1", checkInAt: "2026-09-02T08:00:00Z", checkOutAt: "2026-09-02T12:30:00Z", minutes: 270 },
  { id: "s2", checkInAt: "2026-09-03T08:00:00Z", checkOutAt: null, minutes: null },
];

function renderTracking(
  overrides: Partial<Parameters<typeof EmployerAssignmentTracking>[0]> = {},
) {
  const action = vi.fn(async (state: unknown, formData: FormData) => {
    void state;
    void formData;
    return { status: "idle" } as const;
  });

  render(
    <EmployerAssignmentTracking
      timeline={timeline}
      sessions={sessions}
      completion={{ available: true, blockedReason: null }}
      action={action}
      {...overrides}
    />,
  );

  return { action };
}

describe("işveren atama takibi", () => {
  it("dört aşamayı sırayla çizer ve ulaşılmamış adımı işaretler", () => {
    renderTracking();

    const steps = within(screen.getByRole("list", { name: "Atama zaman çizelgesi" }))
      .getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent("Teklif işçiye gönderildi");
    expect(steps[3]).toHaveTextContent("İş tamamlandı olarak işaretlendi");
    expect(steps[3]).toHaveAttribute("data-reached", "false");
    expect(steps[0]).toHaveAttribute("data-reached", "true");
  });

  it("çalışma oturumlarını süresiyle listeler ve toplamı yazar", () => {
    renderTracking();

    expect(screen.getByText("Toplam 4 sa 30 dk")).toBeVisible();
    expect(screen.getByText("4 sa 30 dk")).toBeVisible();
    expect(screen.getByText("Devam ediyor")).toBeVisible();
  });

  it("hiç oturum yokken bunu yazar", () => {
    renderTracking({ sessions: [] });

    expect(screen.getByText("Henüz çalışma oturumu kaydı yok.")).toBeVisible();
  });

  it("tamamlama açıkken düğmeyi çizer", async () => {
    const user = userEvent.setup();
    const { action } = renderTracking();

    const button = screen.getByRole("button", { name: "İşi tamamlandı işaretle" });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("tamamlama kapalıyken düğmeyi kilitler ve nedenini yanına yazar", () => {
    // Kapalı bir eylemi sebepsiz gizlemek, kullanıcıya atamanın neden
    // tamamlanamadığını hiç söylememek olurdu.
    renderTracking({
      completion: {
        available: false,
        blockedReason: "İşçi atamayı onaylamadan iş tamamlandı olarak işaretlenemez.",
      },
    });

    expect(screen.getByRole("button", { name: "İşi tamamlandı işaretle" })).toBeDisabled();
    expect(
      screen.getByText("İşçi atamayı onaylamadan iş tamamlandı olarak işaretlenemez."),
    ).toBeVisible();
  });

  it.each([
    ["ASSIGNMENT_PAYMENT_NOT_SECURED", /emanet/i],
    ["JOB_ASSIGNMENT_NOT_COMPLETABLE", /durum/i],
  ])("sunucunun %s reddini kendi Türkçe metnine çevirir", async (errorCode, expected) => {
    // İki kod da `conflict` ailesinde; aile metni ("Bu kayıt başka bir duruma
    // geçmiş olabilir") ikisini de aynı şeye benzetirdi, oysa yapılacak iş
    // farklı: birinde ödeme, öbüründe atamanın durumu.
    const user = userEvent.setup();
    renderTracking({
      action: vi.fn(async (state: unknown, formData: FormData) => {
        void state;
        void formData;
        return { status: "error", errorCode, httpStatus: 409 } as const;
      }),
    });

    await user.click(screen.getByRole("button", { name: "İşi tamamlandı işaretle" }));

    expect(screen.getByRole("alert")).toHaveTextContent(expected);
  });

  it("tamamlama başarılıysa sonucu ekranda söyler", async () => {
    const user = userEvent.setup();
    renderTracking({
      action: vi.fn(async (state: unknown, formData: FormData) => {
        void state;
        void formData;
        return { status: "done" } as const;
      }),
    });

    await user.click(screen.getByRole("button", { name: "İşi tamamlandı işaretle" }));

    expect(screen.getByRole("status")).toHaveTextContent("tamamlandı");
  });
});
