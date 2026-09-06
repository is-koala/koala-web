import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";

import { LoginForm } from "./login-form";

function submitWith(state: FormState) {
  return vi.fn(async () => state);
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-posta"), "aday@example.test");
  await user.type(screen.getByLabelText("Parola"), "parola-yer-tutucu");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
}

describe("giriş formu", () => {
  it("alanları etiketleriyle sunar ve dönüş hedefini taşır", () => {
    render(<LoginForm destination="/panel/islerim" action={submitWith({ status: "idle" })} />);

    expect(screen.getByLabelText("E-posta")).toBeRequired();
    expect(screen.getByLabelText("Parola")).toBeRequired();
    expect(screen.getByDisplayValue("/panel/islerim")).toBeInTheDocument();
  });

  it("gönderim sürerken bekleme durumunu gösterir", async () => {
    let release: (state: FormState) => void = () => {};
    const inFlight = new Promise<FormState>((resolve) => {
      release = resolve;
    });
    render(<LoginForm destination="/" action={vi.fn(() => inFlight)} />);

    await fillAndSubmit();

    expect(await screen.findByRole("button", { name: "Giriş yapılıyor…" })).toBeDisabled();
    release({ status: "idle" });
    await screen.findByRole("button", { name: "Giriş yap" });
  });

  it("kimlik hatasını errorCode üzerinden çözülmüş metinle gösterir", async () => {
    render(
      <LoginForm
        destination="/"
        action={submitWith({
          status: "error",
          errorCode: "AUTH_EMAIL_OR_PASSWORD_MISMATCH",
          httpStatus: 401,
        })}
      />,
    );

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Giriş bilgileri uyuşmuyor");
  });

  it("hız sınırına takılan denemeyi kullanıcıya anlatır", async () => {
    render(
      <LoginForm
        destination="/"
        action={submitWith({ status: "error", errorCode: "AUTH_TOO_MANY_REQUESTS", httpStatus: 429 })}
      />,
    );

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme yaptın");
  });

  it("bilinmeyen kodda nötr yedek metni gösterir", async () => {
    render(
      <LoginForm
        destination="/"
        action={submitWith({ status: "error", errorCode: "YENI_BIR_KOD", httpStatus: 500 })}
      />,
    );

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });
});
