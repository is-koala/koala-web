import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  publicEnvironment: () => ({
    siteUrl: "https://iskoala.com",
    appUrlScheme: "koala",
  }),
}));
vi.mock("./actions", () => ({
  submitSupportAction: vi.fn(),
}));

import Page from "./page";

describe("/iletisim", () => {
  it("şirket kimliğini, KVKK başvuru adresini ve formu gösterir", () => {
    render(<Page />);

    expect(screen.getByRole("heading", { name: "Birlikte çözelim." })).toBeInTheDocument();
    expect(screen.getByText("Şirket unvanı")).toBeInTheDocument();
    expect(screen.getByText("Koala")).toBeInTheDocument();
    expect(screen.getByText("KVKK veri sorumlusu başvuru adresi")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "info@iskoala.com" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Konu")).toBeInTheDocument();
    expect(screen.getByLabelText("Ad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute(
      "href",
      "/kvkk-aydinlatma",
    );
  });
});
