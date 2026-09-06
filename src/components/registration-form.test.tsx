import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";

import { RegistrationForm } from "./registration-form";

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Ad"), "Ada");
  await user.type(screen.getByLabelText("Soyad"), "Yılmaz");
  await user.type(screen.getByLabelText("E-posta"), "ada@example.test");
  await user.click(screen.getByRole("button", { name: "Doğrulama bağlantısı gönder" }));
}

function renderForm(state: FormState) {
  render(<RegistrationForm action={vi.fn(async () => state)} />);
}

describe("kayıt formu", () => {
  it("gönderim sonrası hesabın açıldığını iddia etmez", async () => {
    // Uç, adres zaten kayıtlıyken de 200 dönüyor; "hesabın oluşturuldu"
    // demek kayıtlı adresleri ele verirdi.
    renderForm({ status: "done" });

    await fillAndSubmit();

    const panel = await screen.findByRole("status");
    expect(panel).toHaveTextContent("E-postanı kontrol et");
    expect(panel).toHaveTextContent("Bu adres daha önce kayıtlı değilse");
    expect(panel.textContent).not.toContain("hesabın oluşturuldu");
  });

  it("sunucunun e-posta hatasını alanın altına yazar", async () => {
    renderForm({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { email: "Geçerli bir e-posta adresi giriniz." },
    });

    await fillAndSubmit();

    expect(await screen.findByLabelText("E-posta")).toHaveAccessibleDescription(
      /Geçerli bir e-posta adresi giriniz\./,
    );
  });

  it("hız sınırını üst bantta anlatır", async () => {
    renderForm({ status: "error", errorCode: "AUTH_TOO_MANY_REQUESTS", httpStatus: 429 });

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme yaptın");
  });
});
