import { describe, expect, it, vi } from "vitest";

import type { Agreement } from "@/lib/consents";
import { idleFormState } from "@/lib/form-state";
import { passwordRequirement } from "@/lib/password";

import { redirectTo } from "../../../../tests/support/navigation";

import { completeRegistrationAction } from "./actions";

const completeRegistration = vi.hoisted(() => vi.fn());
const readAgreements = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/registration", () => ({ completeRegistration }));
vi.mock("@/server/legal/agreements", () => ({ readAgreements }));
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../../tests/support/navigation")).throwingRedirect(),
}));

const agreements: Agreement[] = [
  { id: "a1", type: "TERMS_OF_SERVICE", version: "1.0", mandatory: true, contentUrl: null },
  { id: "a2", type: "PRIVACY_POLICY", version: "1.0", mandatory: true, contentUrl: null },
  { id: "a3", type: "COMMERCIAL_MESSAGE", version: "1.0", mandatory: false, contentUrl: null },
];

function submission({
  password = "Koala2026",
  confirmation = "Koala2026",
  granted = ["a1", "a2"],
}: {
  password?: string;
  confirmation?: string;
  granted?: string[];
} = {}) {
  const formData = new FormData();
  formData.set("setPasswordToken", "set-placeholder");
  formData.set("password", password);
  formData.set("passwordConfirmation", confirmation);
  for (const id of granted) formData.append("consents", id);
  return formData;
}

describe("kayıt tamamlama action'ı", () => {
  it("reddedilen isteğe bağlı sözleşmeyi de granted: false ile gönderir", async () => {
    readAgreements.mockResolvedValueOnce(agreements);
    completeRegistration.mockResolvedValueOnce(undefined);

    await completeRegistrationAction(idleFormState, submission()).catch(() => {});

    expect(completeRegistration).toHaveBeenCalledWith({
      setPasswordToken: "set-placeholder",
      password: "Koala2026",
      consents: [
        { agreementVersionId: "a1", granted: true },
        { agreementVersionId: "a2", granted: true },
        { agreementVersionId: "a3", granted: false },
      ],
    });
  });

  it("zorunlu sözleşme işaretlenmeden backend'i hiç aramaz", async () => {
    readAgreements.mockResolvedValueOnce(agreements);

    const state = await completeRegistrationAction(idleFormState, submission({ granted: ["a1"] }));

    expect(completeRegistration).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error", errorCode: "VALIDATION_FAILED" });
    expect(state).toHaveProperty("fieldErrors.consents");
  });

  it("kuralı karşılamayan parolayı sunucuya götürmez", async () => {
    readAgreements.mockResolvedValueOnce(agreements);

    const state = await completeRegistrationAction(
      idleFormState,
      submission({ password: "koala", confirmation: "koala" }),
    );

    expect(completeRegistration).not.toHaveBeenCalled();
    expect(state).toMatchObject({ fieldErrors: { password: passwordRequirement } });
  });

  it("parola tekrarı tutmuyorsa uyarır", async () => {
    readAgreements.mockResolvedValueOnce(agreements);

    const state = await completeRegistrationAction(
      idleFormState,
      submission({ confirmation: "Koala2027" }),
    );

    expect(completeRegistration).not.toHaveBeenCalled();
    expect(state).toHaveProperty("fieldErrors.passwordConfirmation");
  });

  it("kayıt bitince kullanıcıyı oturum açmış olarak ana sayfaya alır", async () => {
    readAgreements.mockResolvedValueOnce(agreements);
    completeRegistration.mockResolvedValueOnce(undefined);

    await expect(completeRegistrationAction(idleFormState, submission())).rejects.toThrowError(
      new Error(redirectTo("/")),
    );
  });
});
