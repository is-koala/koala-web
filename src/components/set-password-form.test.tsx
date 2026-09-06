import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Agreement } from "@/lib/consents";
import type { FormState } from "@/lib/form-state";

import { SetPasswordForm } from "./set-password-form";

const agreements: Agreement[] = [
  { id: "a1", type: "TERMS_OF_SERVICE", version: "1.0", mandatory: true, contentUrl: null },
  { id: "a3", type: "COMMERCIAL_MESSAGE", version: "1.0", mandatory: false, contentUrl: null },
];

function renderForm(state: FormState = { status: "idle" }) {
  render(
    <SetPasswordForm
      setPasswordToken="set-placeholder"
      agreements={agreements}
      action={vi.fn(async () => state)}
    />,
  );
}

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Parola"), "Koala2026");
  await user.type(screen.getByLabelText("Parola (tekrar)"), "Koala2026");
  await user.click(screen.getByRole("checkbox", { name: /Kullanım Koşulları/ }));
  await user.click(screen.getByRole("button", { name: "Kaydı tamamla" }));
}

describe("parola belirleme formu", () => {
  it("zorunlu sözleşmeyi işaretlenmeden gönderilemez yapar", () => {
    renderForm();

    expect(screen.getByRole("checkbox", { name: /Kullanım Koşulları/ })).toBeRequired();
    expect(screen.getByRole("checkbox", { name: /Ticari İleti İzni/ })).not.toBeRequired();
  });

  it("sözleşme bağlantısını sitenin kendi sürümlü sayfasına verir", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Kullanım Koşulları" })).toHaveAttribute(
      "href",
      "/kullanim-kosullari/v/1.0",
    );
    expect(screen.getByRole("link", { name: "Ticari İleti İzni" })).toHaveAttribute(
      "href",
      "/kvkk-aydinlatma/v/1.0#ticari-ileti",
    );
  });

  it("sunucunun alan mesajını ilgili alanın altına yazar", async () => {
    // Backend alan hatalarını çözülmüş Türkçe olarak `details[]` içinde
    // veriyor; ekran onları alanın kendisine bağlamalı.
    renderForm({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { password: "Parola en az 8 karakter olmalıdır." },
    });

    await submit();

    const field = await screen.findByLabelText("Parola");
    expect(field).toHaveAccessibleDescription(/Parola en az 8 karakter olmalıdır\./);
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("rıza kutusu grubunun hatasını grubun altında gösterir", async () => {
    renderForm({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { consents: "Devam etmek için zorunlu sözleşmeleri onaylaman gerekiyor." },
    });

    await submit();

    expect(
      await screen.findByText("Devam etmek için zorunlu sözleşmeleri onaylaman gerekiyor."),
    ).toBeInTheDocument();
  });
});
