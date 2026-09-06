import { describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import { passwordRequirement } from "@/lib/password";
import { ApiError } from "@/server/api/errors";

import { resetPasswordAction } from "./actions";

const resetPassword = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/password", () => ({ resetPassword }));

function submission({
  newPassword = "Koala2026",
  confirmation = "Koala2026",
  resetToken = "reset-placeholder",
} = {}) {
  const formData = new FormData();
  formData.set("resetToken", resetToken);
  formData.set("newPassword", newPassword);
  formData.set("newPasswordConfirmation", confirmation);
  return formData;
}

describe("parola sıfırlama action'ı", () => {
  it("yeni parolayı tokenıyla birlikte gönderir", async () => {
    resetPassword.mockResolvedValueOnce(undefined);

    await expect(resetPasswordAction(idleFormState, submission())).resolves.toEqual({
      status: "done",
    });
    expect(resetPassword).toHaveBeenCalledWith({
      resetToken: "reset-placeholder",
      newPassword: "Koala2026",
    });
  });

  it("kayıtla aynı parola kuralını uygular", async () => {
    const state = await resetPasswordAction(
      idleFormState,
      submission({ newPassword: "koala123", confirmation: "koala123" }),
    );

    expect(resetPassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({ fieldErrors: { newPassword: passwordRequirement } });
  });

  it("parola tekrarı tutmuyorsa tokenı harcamaz", async () => {
    // Token tek kullanımlık: gereksiz bir gönderim bağlantıyı yakardı.
    const state = await resetPasswordAction(idleFormState, submission({ confirmation: "Koala2027" }));

    expect(resetPassword).not.toHaveBeenCalled();
    expect(state).toHaveProperty("fieldErrors.newPasswordConfirmation");
  });

  it("tüketilmiş tokenı kullanıcıya anlatır", async () => {
    resetPassword.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        errorCode: "AUTH_PASSWORD_RESET_TOKEN_INVALID",
        errorCategory: "VALIDATION_FAILED",
        message: "Token gecersiz.",
      }),
    );

    await expect(resetPasswordAction(idleFormState, submission())).resolves.toMatchObject({
      status: "error",
      errorCode: "AUTH_PASSWORD_RESET_TOKEN_INVALID",
    });
  });
});
