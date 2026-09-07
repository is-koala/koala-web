import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TalentPoolEntry, TalentPoolPage } from "@/applications/employer-review";

import { TalentPoolList } from "./talent-pool-list";

function entry(overrides: Partial<TalentPoolEntry> = {}): TalentPoolEntry {
  return {
    id: "entry-1",
    workerId: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    fullName: "Aday Bir",
    profilePictureUrl: null,
    note: null,
    createdAt: "2026-09-01T22:00:00Z",
    ...overrides,
  };
}

function pool(overrides: Partial<TalentPoolPage> = {}): TalentPoolPage {
  return {
    content: [entry()],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

function idle() {
  return Promise.resolve({ status: "idle" } as const);
}

describe("yetenek havuzu listesi", () => {
  it("havuza eklenme tarihini saatsiz yazar", () => {
    render(<TalentPoolList pool={pool()} action={vi.fn(idle)} />);

    const row = within(screen.getByRole("list", { name: "Yetenek havuzu" })).getByRole("listitem");
    expect(row).toHaveTextContent("2 Eyl 2026 tarihinde eklendi");
    expect(within(row).getByRole("button", { name: "Havuzdan çıkar" })).toBeVisible();
  });

  it("tarihi sunucunun TZ'sinden bağımsız İstanbul saatiyle yazar", () => {
    // Bileşen `"use client"` taşıyor ama ilk HTML'i Next.js sunucuda çiziyor
    // ve üretimde sunucu kapsayıcıda `TZ=UTC` ile koşuyor. Saatsiz biçimde
    // ayrışma daha da sinsi: ekranda yalnız **gün** değişiyor ve kullanıcının
    // bakacağı bir saat yok. Seçilen an bu yüzden gece yarısını geçiriyor —
    // UTC'de 1 Eylül, İstanbul'da 2 Eylül.
    //
    // Testin ev dilimi zaten Europe/Istanbul olduğu için, düşman dilim
    // olmadan yukarıdaki iddia sabit kaldırılsa da yeşil kalırdı.
    const previous = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // Denemenin gerçekten uygulandığının kanıtı.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
      render(<TalentPoolList pool={pool()} action={vi.fn(idle)} />);

      expect(screen.getByRole("listitem")).toHaveTextContent("2 Eyl 2026 tarihinde eklendi");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("tarih okunamadığında ham metni makineye tarih diye sunmaz", () => {
    // `TalentPoolEntryDto.createdAt` yanıtta eksikse model boş dizeye
    // düşüyor. `<time dateTime="">` makineye tutamayacağı bir söz verirdi.
    render(<TalentPoolList pool={pool({ content: [entry({ createdAt: "" })] })} action={vi.fn(idle)} />);

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Aday Bir")).toBeVisible();
    expect(row.querySelector("time")).toBeNull();
  });
});
