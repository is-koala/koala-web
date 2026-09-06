import { render, screen } from "@testing-library/react";
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
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Profilim" })).toBeInTheDocument();
    expect(screen.getByText("%100 tamamlandı")).toBeInTheDocument();
    expect(screen.getAllByText("Barista").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Koala Üniversitesi").length).toBeGreaterThan(0);
    expect(screen.getByText("Anlık bildirim · İş alarmları")).toBeInTheDocument();
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
      />,
    );

    expect(screen.getByText("Henüz deneyim eklemedin")).toBeInTheDocument();
    expect(screen.getByText("Henüz eğitim eklemedin")).toBeInTheDocument();
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
      />,
    );

    expect(screen.getByText("Eğitimi düzenle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eğitimi sil" })).toBeInTheDocument();
    expect(screen.queryByText("Yeni eğitim ekle")).not.toBeInTheDocument();
    expect(screen.getByText("Eğitim kataloğu henüz hazır değil")).toBeInTheDocument();
  });
});
