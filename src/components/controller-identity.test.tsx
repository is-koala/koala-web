import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ControllerIdentity } from "./controller-identity";

describe("veri sorumlusu kimliği", () => {
  it("KVKK başvuru adresini e-posta ve iletişim formu olarak gösterir", () => {
    render(<ControllerIdentity heading="Veri sorumlusu başvuru adresi" />);

    expect(screen.getByRole("heading", { name: "Veri sorumlusu başvuru adresi" })).toBeInTheDocument();
    expect(screen.getByText("Şirket unvanı")).toBeInTheDocument();
    expect(screen.getByText("Koala")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "info@iskoala.com" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "İletişim formu" })).toHaveAttribute("href", "/iletisim");
    expect(screen.getByText(/Tescilli ticaret unvanı/)).toBeInTheDocument();
    expect(screen.getByText(/Tebligat adresi/)).toBeInTheDocument();
  });
});
