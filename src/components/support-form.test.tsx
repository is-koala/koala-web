import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";

import { SupportForm } from "./support-form";

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Konu"), "destek");
  await user.type(screen.getByLabelText("Ad"), "Ada Yılmaz");
  await user.type(screen.getByLabelText("E-posta"), "ada@example.test");
  await user.type(screen.getByLabelText("Mesaj"), "Hesap silme talebim görünmüyor.");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Gönder" }));
}

function renderForm(state: FormState) {
  render(<SupportForm action={vi.fn(async () => state)} />);
}

describe("destek formu", () => {
  it("gönderim sonrası onay panelini D4 durum kartıyla çizer", async () => {
    renderForm({ status: "done" });

    await fillAndSubmit();

    const panel = await screen.findByRole("status");
    expect(panel).toHaveTextContent("Mesajın bize ulaştı");
    expect(panel).toHaveTextContent("Destek ekibi başvurunu inceleyip");
  });

  it("hız sınırını üst bantta D4 sözleşmesiyle anlatır", async () => {
    renderForm({ status: "error", errorCode: "TOO_MANY_REQUESTS", httpStatus: 429 });

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme yaptın");
  });

  it("aydınlatma metnine bağlar ve bal küpünü gizler", () => {
    renderForm({ status: "idle" });

    expect(screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute(
      "href",
      "/kvkk-aydinlatma",
    );
    expect(screen.getByLabelText("Konu")).toBeInTheDocument();
    expect(screen.getByLabelText("Ad")).toBeInTheDocument();
    expect(screen.getByLabelText("E-posta")).toBeInTheDocument();
    expect(screen.getByLabelText("Mesaj")).toBeInTheDocument();

    const honeypot = document.getElementById("website");
    expect(honeypot).toHaveAttribute("name", "website");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest(".honeypot-field")).toHaveAttribute("aria-hidden", "true");
  });
});
