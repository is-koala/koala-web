import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SettingsAction, SettingsActionState } from "@/app/(uygulama)/hesap-actions";
import type { AccountSettingsData } from "@/server/account-settings/settings";

import { AccountSettings } from "./account-settings";

const rawIban = "TR330006100519786457841326";
const data: AccountSettingsData = {
  bankAccounts: [
    {
      id: "b4bca2a3-ced9-4fc5-8434-6e5a45c26e80",
      maskedIban: "TR33 **** **** **** **** **13 26",
      primary: true,
      verificationStatus: "VERIFIED",
    },
    {
      id: "08e9bbd8-9348-4667-9801-0e887824525a",
      maskedIban: "TR12 **** **** **** **** **99 01",
      primary: false,
      verificationStatus: "REVIEWING_BY_BANK",
    },
  ],
  notifications: {
    unreadCount: 1,
    notifications: {
      content: [
        {
          id: "d0bf18da-c745-4051-a417-b123e4b61016",
          channel: "IN_APP",
          category: "APPLICATION_UPDATES",
          subject: "Başvurun güncellendi",
          body: "Başvurunun durumuna göz atabilirsin.",
          targetType: "JOB_APPLICATION",
          targetId: "5c5e3b10-77f4-41c2-ac33-bc1403879e39",
          status: "SENT",
          sentAt: "2026-09-06T11:30:00Z",
          readAt: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    },
  },
  preferences: [
    {
      category: "JOB_ALERTS",
      kind: "ALERT",
      channel: "EMAIL",
      enabled: true,
      editable: true,
    },
    {
      category: "ACCOUNT_SECURITY",
      kind: "TRANSACTIONAL",
      channel: "IN_APP",
      enabled: true,
      editable: false,
    },
  ],
  sessions: [
    {
      id: "4ace3ee5-f9fd-420c-8926-b35f2b82915a",
      deviceType: "WEB",
      deviceName: "Safari",
      location: "İstanbul",
      lastAccessedAt: "2026-09-06T12:00:00Z",
      current: true,
    },
    {
      id: "0e30edb1-3642-458b-aa0b-7569842448f0",
      deviceType: "MOBILE",
      deviceName: "iPhone",
      location: null,
      lastAccessedAt: "2026-09-05T12:00:00Z",
      current: false,
    },
  ],
};

describe("hesap ve ayarlar ekranı", () => {
  it("yalnız maskeli IBAN'ları ve birincil hesabı gösterir", () => {
    renderSettings();

    expect(screen.getByText("TR33 **** **** **** **** **13 26")).toBeVisible();
    expect(screen.getByText("Birincil hesap")).toBeVisible();
    expect(screen.getByRole("button", { name: "Birincil yap" })).toBeVisible();
    expect(screen.queryByText(rawIban)).toBeNull();
    expect(screen.getByText("Doğrulama durumu bilinmiyor")).toBeVisible();
    expect(screen.queryByText(/REVIEWING_BY_BANK/)).toBeNull();
  });

  it("IBAN eklendiğinde action'a gönderir fakat başarı görünümüne ham değeri taşımaz", async () => {
    const addBankAccount = vi.fn(async (): Promise<SettingsActionState> => ({ status: "done" }));
    renderSettings({ addBankAccount });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("IBAN"), rawIban);
    await user.click(screen.getByRole("button", { name: "Hesap ekle" }));

    expect(addBankAccount).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status", { name: "Banka hesabı sonucu" })).toHaveTextContent(
      "Banka hesabın eklendi",
    );
    expect(screen.queryByText(rawIban)).toBeNull();
    expect(screen.queryByDisplayValue(rawIban)).toBeNull();
  });

  it("iletişim durumlarını ve kod onayı adımını birlikte sunar", async () => {
    const verificationId = "f9601bf0-f398-481c-8c82-d3f84229c119";
    const updateContact = vi.fn(async (): Promise<SettingsActionState> => ({
      status: "done",
      verification: { id: verificationId, type: "EMAIL", sentTo: "yeni@example.test" },
    }));
    renderSettings({ updateContact });
    const user = userEvent.setup();

    expect(screen.getByText("ada@example.test")).toBeVisible();
    expect(screen.getAllByText("Doğrulandı").length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Yeni e-posta"), "yeni@example.test");
    await user.click(screen.getByRole("button", { name: "E-postayı değiştir" }));

    expect(await screen.findByText("yeni@example.test adresine gönderilen kodu gir.")).toBeVisible();
    expect(screen.getByLabelText("Doğrulama kodu")).toBeVisible();
  });

  it("bildirimleri, okunmamış sayısını ve kalıcı okuma eylemini gösterir", () => {
    renderSettings();

    const center = screen.getByRole("region", { name: "Bildirim merkezi" });
    expect(center).toHaveTextContent("1 okunmamış bildirim");
    expect(within(center).getByText("Başvurun güncellendi")).toBeVisible();
    expect(within(center).getByRole("button", { name: "Okundu işaretle" })).toBeVisible();
    expect(within(center).getByRole("button", { name: "Tümünü okundu işaretle" })).toBeVisible();
  });

  it("ilk sayfadan daha eski bildirim sayfasına erişim verir", () => {
    renderSettings({
      data: {
        ...data,
        notifications: {
          ...data.notifications,
          notifications: {
            ...data.notifications.notifications,
            totalElements: 21,
            totalPages: 2,
            last: false,
          },
        },
      },
    });

    expect(screen.getByRole("link", { name: "Daha eski bildirimler" })).toHaveAttribute(
      "href",
      "?bildirimSayfasi=2#bildirimler",
    );
  });

  it("ikinci sayfadaki eski bildirimi gösterip yeni bildirimlere dönüş verir", () => {
    renderSettings({
      data: {
        ...data,
        notifications: {
          unreadCount: 1,
          notifications: {
            content: [
              {
                ...data.notifications.notifications.content[0],
                id: "ec481881-caa5-4407-9d23-71163e186fe8",
                subject: "Eski vardiya hatırlatması",
              },
            ],
            page: 1,
            size: 20,
            totalElements: 21,
            totalPages: 2,
            first: false,
            last: true,
          },
        },
      },
    });

    expect(screen.getByText("Eski vardiya hatırlatması")).toBeVisible();
    expect(screen.getByRole("link", { name: "Daha yeni bildirimler" })).toHaveAttribute(
      "href",
      "?bildirimSayfasi=1#bildirimler",
    );
  });

  it("bilinmeyen bildirim kategorisini backend enum'u yerine nötr Türkçe gösterir", () => {
    renderSettings({
      data: {
        ...data,
        notifications: {
          ...data.notifications,
          notifications: {
            ...data.notifications.notifications,
            content: [
              {
                ...data.notifications.notifications.content[0],
                category: "FUTURE_BACKEND_CATEGORY",
              },
            ],
          },
        },
      },
    });

    const center = screen.getByRole("region", { name: "Bildirim merkezi" });
    expect(within(center).getByText(/Diğer bildirim/)).toBeVisible();
    expect(within(center).queryByText(/FUTURE_BACKEND_CATEGORY/)).toBeNull();
  });

  it("işlemsel tercihi kilitli, isteğe bağlı tercihi değiştirilebilir gösterir", () => {
    renderSettings();

    expect(screen.getByRole("checkbox", { name: /E-posta · İş alarmları/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Uygulama içi · Hesap güvenliği/ })).toBeDisabled();
  });

  it("mevcut cihazı çıkışa, diğer cihazı sonlandırma action'ına bağlar", () => {
    renderSettings();

    const sessions = screen.getByRole("region", { name: "Oturumlar ve cihazlar" });
    expect(within(sessions).getByText("Bu cihaz")).toBeVisible();
    expect(within(sessions).getByRole("link", { name: "Bu cihazdan çıkış yap" })).toHaveAttribute(
      "href",
      "/cikis",
    );
    expect(within(sessions).getByRole("button", { name: "iPhone oturumunu kapat" })).toBeVisible();
    expect(within(sessions).getByRole("button", { name: "Diğer tüm oturumları kapat" })).toBeVisible();
  });

  it("boş banka, bildirim ve oturum listelerini açıkça anlatır", () => {
    renderSettings({
      data: {
        ...data,
        bankAccounts: [],
        notifications: {
          unreadCount: 0,
          notifications: { ...data.notifications.notifications, content: [], totalElements: 0 },
        },
        sessions: [],
      },
    });

    expect(screen.getByText("Henüz banka hesabın yok.")).toBeVisible();
    expect(screen.getByText("Henüz bildirimin yok.")).toBeVisible();
    expect(screen.getByText("Açık oturum bulunamadı.")).toBeVisible();
  });
});

type Overrides = Partial<ReturnType<typeof actions>> & { data?: AccountSettingsData };

function renderSettings(overrides: Overrides = {}) {
  const { data: settingsData = data, ...actionOverrides } = overrides;
  render(
    <AccountSettings
      viewer={{
        email: "ada@example.test",
        phoneNumber: "+905551112233",
        emailVerified: true,
        phoneVerified: false,
      }}
      data={settingsData}
      actions={{ ...actions(), ...actionOverrides }}
    />,
  );
}

function actions() {
  const idle = vi.fn(async (): Promise<SettingsActionState> => ({ status: "idle" }));
  return {
    addBankAccount: idle,
    selectPrimaryBankAccount: idle,
    deleteBankAccount: idle,
    updateContact: idle,
    confirmVerification: idle,
    updatePassword: idle,
    markNotificationRead: idle,
    markAllNotificationsRead: idle,
    revokeSession: idle,
    revokeOtherSessions: idle,
  } satisfies Record<string, SettingsAction>;
}
