import { describe, expect, it } from "vitest";

import { profileCompletion, type ProfileSummary } from "./profile";

function profile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    firstName: "Ayşe",
    lastName: "Yıldız",
    profilePictureUrl: "https://cdn.example.test/ayse.webp",
    jobTitle: "Barista",
    about: "Kahve ve misafir deneyimi alanında çalışıyorum.",
    qualifications: "Espresso, kasa, ekip çalışması",
    interests: "Kafe ve etkinlik işleri",
    experiences: [{ id: "experience-1" }],
    educations: [{ id: "education-1" }],
    ...overrides,
  };
}

describe("profil tamamlama göstergesi", () => {
  it("dolu profil için yüzde 100 döndürür", () => {
    expect(profileCompletion(profile())).toEqual({ percentage: 100, missing: [] });
  });

  it("yalnız gerçekten boş alanları Türkçe eylem olarak listeler", () => {
    expect(
      profileCompletion(
        profile({
          profilePictureUrl: " ",
          about: null,
          experiences: [],
        }),
      ),
    ).toEqual({
      percentage: 63,
      missing: ["Profil fotoğrafı ekle", "Hakkında alanını doldur", "Deneyim ekle"],
    });
  });
});
