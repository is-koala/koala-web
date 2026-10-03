import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";
import type { NotificationPreference } from "@/lib/profile";

import { NotificationPreferencesForm } from "./notification-preferences-form";

const updateNotificationPreferencesAction = vi.hoisted(() =>
  vi.fn<(state: FormState, formData: FormData) => Promise<FormState>>(),
);

vi.mock("@/app/(uygulama)/panel/profil/notification-actions", () => ({
  updateNotificationPreferencesAction,
}));

const preferences: NotificationPreference[] = [
  { category: "NEWSLETTER", kind: "COMMERCIAL", channel: "SMS", enabled: false, editable: true },
  { category: "MESSAGES", kind: "ALERT", channel: "EMAIL", enabled: true, editable: true },
  { category: "TRANSPORT", kind: "TRANSACTIONAL", channel: "PUSH", enabled: true, editable: false },
];

describe("bildirim tercihleri formu", () => {
  it("yüklenen değerleri gönderimle birlikte taşır ki yalnız değişen satır yazılsın", async () => {
    updateNotificationPreferencesAction.mockResolvedValue({ status: "done" });
    render(<NotificationPreferencesForm preferences={preferences} contactHref="#iletisim" />);

    await userEvent.click(screen.getByRole("checkbox", { name: /SMS · Bülten/ }));
    await userEvent.click(screen.getByRole("button", { name: "İletişim tercihlerini kaydet" }));

    const formData = updateNotificationPreferencesAction.mock.calls[0][1];
    expect(formData.getAll("initialPreferences")).toEqual([
      "NEWSLETTER|SMS|false",
      "MESSAGES|EMAIL|true",
    ]);
  });

  it("değişiklik yoksa güncellendi demez", async () => {
    updateNotificationPreferencesAction.mockResolvedValue({ status: "done", unchanged: true });
    render(<NotificationPreferencesForm preferences={preferences} contactHref="#iletisim" />);

    await userEvent.click(screen.getByRole("button", { name: "İletişim tercihlerini kaydet" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Değişiklik yok");
    expect(status).not.toHaveTextContent("güncellendi");
  });

  it("ticari izin doğrulanmamış alıcıyla reddedilirse iletişim doğrulamasına yönlendirir", async () => {
    updateNotificationPreferencesAction.mockResolvedValue({
      status: "error",
      errorCode: "IYS_VERIFIED_RECIPIENT_REQUIRED",
      httpStatus: 400,
    });
    render(<NotificationPreferencesForm preferences={preferences} contactHref="/panel/hesap#iletisim" />);

    await userEvent.click(screen.getByRole("checkbox", { name: /SMS · Bülten/ }));
    await userEvent.click(screen.getByRole("button", { name: "İletişim tercihlerini kaydet" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Önce iletişim bilgini doğrula");
    expect(within(alert.parentElement!).getByRole("link", { name: "Telefonunu ve e-postanı doğrula" }))
      .toHaveAttribute("href", "/panel/hesap#iletisim");
  });

  it("kapatılamayan satırı hesap güvenliği diye değil, işlem bildirimi diye anlatır", () => {
    render(<NotificationPreferencesForm preferences={preferences} contactHref="#iletisim" />);

    const locked = screen.getByRole("checkbox", { name: /Anlık bildirim · Ulaşım/ }).closest("label")!;
    expect(locked).toHaveTextContent("Bu bildirim kapatılamaz: işlem bildirimi.");
    expect(locked).not.toHaveTextContent("Hesap işlemleri");
  });
});
