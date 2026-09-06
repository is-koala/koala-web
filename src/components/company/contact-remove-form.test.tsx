import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { idleFormState, type FormState } from "@/lib/form-state";

import { ContactRemoveForm } from "./contact-remove-form";

const action = async (): Promise<FormState> => idleFormState;

describe("yetkili çıkarma onayı", () => {
  it("ilk dokunuşta çıkarmaz, onay ister", async () => {
    // Çıkarmanın geri dönüşü yok: kişiyi geri eklemenin tek yolu yeni bir
    // davet ve davet ancak karşı taraf kabul ederse geçerli oluyor.
    const user = userEvent.setup();
    render(<ContactRemoveForm action={action} personName="Deniz Ak" />);

    expect(screen.queryByRole("button", { name: "Evet, çıkar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yetkiliyi çıkar" }));

    expect(screen.getByRole("button", { name: "Evet, çıkar" })).toBeInTheDocument();
  });

  it("onay cümlesini kişinin adıyla kurar", async () => {
    // `SafeUserDto` e-posta taşımıyor; ekranda kişiyi ayırt eden başka bir
    // alan yok, yani onay adla kurulmak zorunda.
    const user = userEvent.setup();
    render(<ContactRemoveForm action={action} personName="Deniz Ak" />);
    await user.click(screen.getByRole("button", { name: "Yetkiliyi çıkar" }));

    expect(screen.getByText(/Deniz Ak şirketin yetkili listesinden çıkarılsın mı/)).toBeInTheDocument();
  });

  it("vazgeçildiğinde hiçbir şey göndermeden başa döner", async () => {
    const user = userEvent.setup();
    render(<ContactRemoveForm action={action} personName="Deniz Ak" />);
    await user.click(screen.getByRole("button", { name: "Yetkiliyi çıkar" }));
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("button", { name: "Evet, çıkar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yetkiliyi çıkar" })).toBeInTheDocument();
  });
});
