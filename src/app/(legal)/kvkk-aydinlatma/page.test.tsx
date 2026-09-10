import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  publicEnvironment: () => ({
    siteUrl: "https://iskoala.com",
    appUrlScheme: "koala",
  }),
}));

vi.mock("@/content/legal/cerez-politikasi/1.0.mdx", () => ({ default: () => null }));
vi.mock("@/content/legal/cerez-politikasi/1.1.mdx", () => ({ default: () => null }));
vi.mock("@/content/legal/gizlilik-politikasi/1.0.mdx", () => ({ default: () => null }));
vi.mock("@/content/legal/kullanim-kosullari/1.0.mdx", () => ({ default: () => null }));
vi.mock("@/content/legal/kvkk-aydinlatma/1.0.mdx", () => ({
  default: () => <h1>KVKK Aydınlatma Metni</h1>,
}));
vi.mock("@/content/legal/mesafeli-hizmet-sozlesmesi/1.0.mdx", () => ({
  default: () => null,
}));

import Page from "./page";

describe("/kvkk-aydinlatma", () => {
  it("KVKK başvuru adresini aydınlatma sayfasında da gösterir", () => {
    render(<Page />);

    expect(screen.getByRole("heading", { name: "KVKK Aydınlatma Metni" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Veri sorumlusu başvuru adresi" })).toBeInTheDocument();
    expect(screen.getByText("KVKK veri sorumlusu başvuru adresi")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "info@iskoala.com" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "İletişim formu" })).toHaveAttribute("href", "/iletisim");
  });
});
