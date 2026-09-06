import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FormAction, FormState } from "@/lib/form-state";

import { JobApplicationForm } from "./job-application-form";

describe("ilan başvuru formu", () => {
  afterEach(cleanup);

  it("yalnız opsiyonel 2000 karakterlik not alanını ve başvuru eylemini sunar", () => {
    render(<JobApplicationForm action={resolvedWith({ status: "idle" })} />);

    expect(screen.getByLabelText("Başvuru notu (isteğe bağlı)")).not.toBeRequired();
    expect(screen.getByLabelText("Başvuru notu (isteğe bağlı)")).toHaveAttribute(
      "maxlength",
      "2000",
    );
    expect(screen.getByRole("button", { name: "Başvuruyu gönder" })).toBeEnabled();
  });

  it("ilk gönderim sürerken düğmeyi kapatır ve çift tıklamayı ikinci isteğe dönüştürmez", async () => {
    let finish: (state: FormState) => void = () => {};
    const pending = new Promise<FormState>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(() => pending);
    const user = userEvent.setup();
    render(<JobApplicationForm action={action} />);

    await user.dblClick(screen.getByRole("button", { name: "Başvuruyu gönder" }));

    expect(await screen.findByRole("button", { name: "Başvuru gönderiliyor…" })).toBeDisabled();
    expect(action).toHaveBeenCalledTimes(1);
    finish({ status: "idle" });
    await screen.findByRole("button", { name: "Başvuruyu gönder" });
  });

  it.each([
    ["APPLICANT_IDENTITY_NOT_VERIFIED", "Kimliğini doğrulaman gerekiyor", "/uygulamayi-ac"],
    ["APPLICANT_ADDRESS_REQUIRED", "Adresini eklemen gerekiyor", "/uygulamayi-ac"],
    [
      "APPLICANT_BANK_ACCOUNT_REQUIRED",
      "Ödeme hesabını eklemen gerekiyor",
      "/panel/hesap#banka-hesaplari",
    ],
  ])("%s kapısını açıklayıp çözüm ekranına bağlar", async (errorCode, title, href) => {
    const user = userEvent.setup();
    render(
      <JobApplicationForm
        action={resolvedWith({ status: "error", errorCode, httpStatus: 400 })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Başvuruyu gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(title);
    expect(screen.getByRole("link", { name: /tamamla|ekle/i })).toHaveAttribute("href", href);
  });

  it.each([
    [400, "JOB_APPLICATION_USER_CANNOT_APPLY_TO_OWN_JOB", "Kendi ilanına başvuramazsın"],
    [401, "AUTHENTICATION_REQUIRED", "Oturum açman gerekiyor"],
    [404, "JOB_NOT_FOUND", "İçerik bulunamadı"],
    [409, "JOB_APPLICATION_USER_ALREADY_APPLIED_TO_JOB", "Bu ilana zaten başvurdun"],
  ])("%i / %s sonucunu ayrı kullanıcı metniyle gösterir", async (httpStatus, errorCode, title) => {
    const user = userEvent.setup();
    render(
      <JobApplicationForm
        action={resolvedWith({ status: "error", errorCode, httpStatus })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Başvuruyu gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(title);
  });
});

function resolvedWith(state: FormState): FormAction {
  return vi.fn(async () => state);
}
