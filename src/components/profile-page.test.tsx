import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { EditableProfile } from "@/lib/profile";

import { ProfilePageView } from "./profile-page";

function profile(overrides: Partial<EditableProfile> = {}): EditableProfile {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Ayşe",
    lastName: "Yıldız",
    email: "ayse@example.test",
    phoneNumber: "+905551112233",
    emailVerified: true,
    phoneVerified: false,
    identityVerified: false,
    badges: [],
    profilePictureUrl: "https://cdn.example.test/ayse.webp",
    jobTitle: "Barista",
    about: "Misafir deneyimi alanında çalışıyorum.",
    qualifications: "Espresso, kasa",
    interests: "Kafe ve etkinlik işleri",
    experiences: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Barista",
        companyName: "Koala Kafe",
        employmentType: "PART_TIME",
        cityName: "İstanbul",
        startDate: "2025-01-10",
        endDate: null,
        description: "Kahve hazırlığı",
      },
    ],
    educations: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        universityId: "44444444-4444-4444-8444-444444444444",
        universityName: "Koala Üniversitesi",
        facultyId: "55555555-5555-4555-8555-555555555555",
        facultyName: "İletişim Fakültesi",
        departmentId: "66666666-6666-4666-8666-666666666666",
        departmentName: "Halkla İlişkiler",
        type: "GRADUATE",
        gpa: 3.42,
        startDate: "2020-09-01",
        endDate: "2024-06-15",
      },
    ],
    ...overrides,
  };
}

const emptyAvailability = { status: "ready", data: { slots: [], exceptions: [] } } as const;

describe("profil sayfası", () => {
  it("tamamlanma, profil, deneyim, eğitim ve iletişim tercihlerinin hepsini gösterir", () => {
    const { container } = render(
      <ProfilePageView
        profile={profile()}
        preferences={{
          status: "ready",
          data: [
            {
              category: "JOB_ALERTS",
              kind: "ALERT",
              channel: "PUSH",
              enabled: true,
              editable: true,
            },
            {
              category: "ACCOUNT_SECURITY",
              kind: "TRANSACTIONAL",
              channel: "EMAIL",
              enabled: true,
              editable: false,
            },
          ],
        }}
        universities={{
          status: "ready",
          data: [{ id: "44444444-4444-4444-8444-444444444444", name: "Koala Üniversitesi" }],
        }}
        availability={{
          status: "ready",
          data: {
            slots: [
              { id: "s1", dayOfWeek: "FRIDAY", startTime: "18:00", endTime: "23:00" },
              { id: "s2", dayOfWeek: "MONDAY", startTime: "09:00:00", endTime: "13:00:00" },
            ],
            exceptions: [{ id: "77777777-7777-4777-8777-777777777777", date: "2026-10-29", available: false, note: "Bayram" }],
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Profilim" })).toBeInTheDocument();
    expect(screen.getByText("%100 tamamlandı")).toBeInTheDocument();
    expect(screen.getAllByText("Barista").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Koala Üniversitesi").length).toBeGreaterThan(0);
    expect(screen.getByText("Anlık bildirim · İş alarmları")).toBeInTheDocument();
    // Müsaitlik haftanın sırasında ve saniyesiz; istisna tarih ve durumla.
    const rows = within(screen.getByRole("list", { name: "Haftalık müsaitlik aralıkları" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByLabelText("Gün")).toHaveValue("MONDAY");
    expect(within(rows[0]).getByLabelText("Başlangıç")).toHaveValue("09:00");
    expect(within(rows[1]).getByLabelText("Gün")).toHaveValue("FRIDAY");
    expect(screen.getByRole("button", { name: "Müsaitliği kaydet" })).toBeInTheDocument();
    const exceptions = within(screen.getByRole("list", { name: "Tarih istisnaları" }));
    expect(exceptions.getByText("Müsait değilim")).toBeInTheDocument();
    expect(exceptions.getByText("Bayram")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "İstisnayı sil" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Hesap güvenliği/ })).toBeDisabled();

    const fieldIds = [...container.querySelectorAll("input[id], select[id], textarea[id]")].map(
      ({ id }) => id,
    );
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
  });

  it("boş listeleri ve bağımsız yardımcı veri hatasını Türkçe açıklar", () => {
    render(
      <ProfilePageView
        profile={profile({ profilePictureUrl: null, experiences: [], educations: [] })}
        preferences={{ status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 }}
        universities={{ status: "ready", data: [] }}
        availability={emptyAvailability}
      />,
    );

    expect(screen.getByText("Henüz deneyim eklemedin")).toBeInTheDocument();
    expect(screen.getByText("Henüz eğitim eklemedin")).toBeInTheDocument();
    expect(screen.getByText("Henüz rozetin yok")).toBeInTheDocument();
    expect(screen.getByText(/Henüz haftalık aralık yok/)).toBeInTheDocument();
    expect(screen.getByText("Henüz tarih istisnan yok.")).toBeInTheDocument();
    expect(screen.getByText("Hizmete ulaşılamıyor")).toBeInTheDocument();
    expect(screen.getByText("Eğitim kataloğu henüz hazır değil")).toBeInTheDocument();
    expect(screen.queryByText("EXTERNAL_SERVICE")).not.toBeInTheDocument();
  });

  it("üniversite kataloğu okunamadığında mevcut eğitimi düzenlenebilir bırakır", () => {
    render(
      <ProfilePageView
        profile={profile()}
        preferences={{ status: "ready", data: [] }}
        universities={{ status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 }}
        availability={emptyAvailability}
      />,
    );

    expect(screen.getByText("Eğitimi düzenle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eğitimi sil" })).toBeInTheDocument();
    expect(screen.queryByText("Yeni eğitim ekle")).not.toBeInTheDocument();
    expect(screen.getByText("Hizmete ulaşılamıyor")).toBeInTheDocument();
  });

  it("üniversite kataloğu boşken mevcut eğitimi düzenlenebilir bırakır", () => {
    render(
      <ProfilePageView
        profile={profile()}
        preferences={{ status: "ready", data: [] }}
        universities={{ status: "ready", data: [] }}
        availability={emptyAvailability}
      />,
    );

    expect(screen.getByText("Eğitimi düzenle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eğitimi sil" })).toBeInTheDocument();
    expect(screen.queryByText("Yeni eğitim ekle")).not.toBeInTheDocument();
    expect(screen.getByText("Eğitim kataloğu henüz hazır değil")).toBeInTheDocument();
  });

  it("rozetleri kademesi ve kazanılma tarihiyle listeler", () => {
    render(
      <ProfilePageView
        profile={profile({
          badges: [
            {
              code: "PUNCTUALITY_GOLD",
              family: "PUNCTUALITY",
              tier: "GOLD",
              name: "Dakik",
              description: "Son on işe zamanında geldin.",
              iconUrl: "https://cdn.example.test/badges/punctual.webp",
              earnedAt: "2026-09-01T10:00:00Z",
            },
            {
              code: "IDENTITY",
              family: "IDENTITY",
              tier: "NONE",
              name: "Kimliği doğrulanmış",
              description: null,
              iconUrl: "javascript:alert(1)",
              earnedAt: null,
            },
          ],
        })}
        preferences={{ status: "ready", data: [] }}
        universities={{ status: "ready", data: [] }}
        availability={emptyAvailability}
      />,
    );

    const badges = within(screen.getByRole("list", { name: "Rozetler" })).getAllByRole("listitem");
    expect(badges).toHaveLength(2);
    expect(within(badges[0]).getByRole("heading", { name: "Dakik" })).toBeInTheDocument();
    expect(within(badges[0]).getByText(/Altın · Kazanıldı: 1 Eyl 2026/)).toBeInTheDocument();
    // Güvenli olmayan görsel adresi çizilmez; yer tutucu simge kalır.
    expect(within(badges[1]).queryByRole("img")).toBeNull();
    expect(screen.queryByText("NONE")).toBeNull();
  });

  it("müsaitlik okunamadığında yalnız o bölümde hata gösterir, aralık formu çizilmez", () => {
    render(
      <ProfilePageView
        profile={profile()}
        preferences={{ status: "ready", data: [] }}
        universities={{ status: "ready", data: [] }}
        availability={{ status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 }}
      />,
    );

    expect(screen.getByText("Hizmete ulaşılamıyor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Müsaitliği kaydet" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Profilim" })).toBeInTheDocument();
  });

  it("aralık eklenip kaldırılabilir; satırlar gönderilecek alan adlarını taşır", async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageView
        profile={profile()}
        preferences={{ status: "ready", data: [] }}
        universities={{ status: "ready", data: [] }}
        availability={emptyAvailability}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aralık ekle" }));
    await user.click(screen.getByRole("button", { name: "Aralık ekle" }));
    const list = screen.getByRole("list", { name: "Haftalık müsaitlik aralıkları" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getAllByRole("combobox", { name: "Gün" })[0]).toHaveAttribute("name", "slotDay");

    await user.click(screen.getByRole("button", { name: "1. aralığı kaldır" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });
});
